/* eslint-env jest */
/**
 * Очередь бронирования — данные автора объявления.
 *
 * `GET /api/ads/:adId/bookings` и `.../stats` требовали только войти в аккаунт:
 * любой сосед мог открыть чужое объявление и получить список забронировавших с
 * именами. Теперь счётчик остаётся публичным, а имена — у автора и модерации.
 */

import { GetBookingsUseCase } from "../../../application/use-cases/booking/GetBookingsUseCase.js";
import { BookingController } from "../../../presentation/controllers/BookingController.js";
import { ForbiddenError } from "../../../core/errors/AppError.js";

const owner = { user_id: 7n, roles: [] };
const stranger = { user_id: 8n, roles: [] };
const moderator = { user_id: 9n, roles: ["global:moderator"] };

const bookingRow = (name) => ({
  id: 1n,
  order_text: name,
  toJSON() {
    return { id: 1, order_text: name };
  },
});

const repositories = (adUserId = 7n) => {
  const calls = { active: [], stats: 0 };
  return {
    calls,
    bookingRepository: {
      findActiveBookingsByAd: async (adId) => {
        calls.active.push(adId);
        return [bookingRow("Иван"), bookingRow("Мария")];
      },
      findAllBookingsByAd: async () => [bookingRow("Иван")],
      getAdBookingStats: async () => {
        calls.stats += 1;
        return {
          activeCount: 2,
          totalCount: 5,
          cancelledCount: 3,
          bookings: [bookingRow("Иван"), bookingRow("Мария")],
        };
      },
    },
    adRepository: {
      findById: async () => ({ id: 1n, user_id: adUserId, status: "active" }),
    },
    userRepository: { findById: async () => null },
  };
};

const useCaseFor = (adUserId) => {
  const repos = repositories(adUserId);
  return {
    repos,
    useCase: new GetBookingsUseCase(
      repos.bookingRepository,
      repos.adRepository,
      repos.userRepository
    ),
  };
};

describe("GetBookingsUseCase.getAdBookings", () => {
  it("автор видит очередь целиком", async () => {
    const { useCase } = useCaseFor(7n);

    const result = await useCase.getAdBookings({ adId: 1, viewer: owner });

    expect(result.total).toBe(2);
    expect(result.bookings[0].order_text).toBe("Иван");
  });

  it("чужой объявление очереди не отдаёт", async () => {
    const { repos, useCase } = useCaseFor(7n);

    await expect(useCase.getAdBookings({ adId: 1, viewer: stranger })).rejects.toBeInstanceOf(
      ForbiddenError
    );
    // Список даже не запрашивается: проверка идёт до чтения брони.
    expect(repos.calls.active).toEqual([]);
  });

  it("модерация видит очередь любого объявления", async () => {
    const { useCase } = useCaseFor(7n);

    await expect(useCase.getAdBookings({ adId: 1, viewer: moderator })).resolves.toHaveProperty(
      "total",
      2
    );
  });

  it("без токена очереди нет", async () => {
    const { useCase } = useCaseFor(7n);

    await expect(useCase.getAdBookings({ adId: 1 })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("BigInt автора и строка из токена совпадают", async () => {
    const { useCase } = useCaseFor(7n);

    await expect(
      useCase.getAdBookings({ adId: 1, viewer: { user_id: "7", roles: [] } })
    ).resolves.toHaveProperty("total", 2);
  });
});

describe("GetBookingsUseCase.getAdBookingStats", () => {
  it("чужому — счётчик без имён", async () => {
    const { useCase } = useCaseFor(7n);

    const stats = await useCase.getAdBookingStats({ adId: 1, viewer: stranger });

    expect(stats).toMatchObject({ activeCount: 2, totalCount: 5, queueVisible: false });
    expect(stats.bookings).toEqual([]);
  });

  it("автору — счётчик и список", async () => {
    const { useCase } = useCaseFor(7n);

    const stats = await useCase.getAdBookingStats({ adId: 1, viewer: owner });

    expect(stats.queueVisible).toBe(true);
    expect(stats.bookings).toHaveLength(2);
  });
});

describe("BookingController прокидывает смотрителя", () => {
  const respond = () => {
    const sent = {};
    return {
      sent,
      res: { json: (body) => Object.assign(sent, body) },
      // `asyncHandler` ошибки отдаёт дальше, а не бросает сам.
      next: (error) => {
        throw error;
      },
    };
  };

  it("статистика идёт с req.user, а не без него", async () => {
    const seen = [];
    const controller = new BookingController(null, null, {
      getAdBookingStats: async (args) => {
        seen.push(args);
        return { queueVisible: false, bookings: [] };
      },
    });

    const first = respond();
    const second = respond();
    await controller.getAdBookingStats({ params: { adId: "1" }, user: owner }, first.res, first.next);
    await controller.getAdBookingStats({ params: { adId: "1" } }, second.res, second.next);

    expect(seen.map((call) => call.viewer)).toEqual([owner, null]);
  });

  it("список брони идёт с req.user", async () => {
    const seen = [];
    const controller = new BookingController(null, null, {
      getAdBookings: async (args) => {
        seen.push(args);
        return { bookings: [], total: 0 };
      },
    });

    const answer = respond();
    await controller.getAdBookings(
      { params: { adId: "1" }, query: {}, user: moderator },
      answer.res,
      answer.next
    );

    expect(seen[0].viewer).toBe(moderator);
  });
});
