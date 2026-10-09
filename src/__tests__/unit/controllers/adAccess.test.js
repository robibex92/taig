import { describe, it, expect, beforeEach } from "@jest/globals";

import { AdController } from "../../../presentation/controllers/AdController.js";
import {
  getAdsQuerySchema,
  userAdsQuerySchema,
} from "../../../core/validation/schemas/ad.schema.js";

/**
 * Доступ к объявлениям на бэке: что можно вытащить списком и кого считать
 * смотрителем карточки.
 *
 * Проверены два правила, которые легко потерять при правке маршрутов:
 * витрина без прав модерации отдаёт только активные (параметр `status` из
 * запроса гостя не действует), а карточка неактивного объявления смотрит, кто её
 * открыл, — это решает `GetAdByIdUseCase`.
 */

const calls = [];

const adRepository = {
  getTelegramMessagesByAdId: async (id) => {
    calls.push({ method: "telegramMessages", id });
    return [];
  },
};

const controller = new AdController({
  adRepository,
  getAdsUseCase: {
    execute: async (filters, pagination) => {
      calls.push({ method: "getAds", filters, pagination });
      return { ads: [], page: 1, limit: 20, total: 0, totalPages: 0 };
    },
  },
  getAdByIdUseCase: {
    execute: async (id, increment, viewer) => {
      calls.push({ method: "getAdById", id, increment, viewer });
      return { id, user_id: 7n, status: "active", toJSON: () => ({ id }) };
    },
  },
});

const respond = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = { status: () => res, json: resolve };
    handler(req, res, reject);
  });

beforeEach(() => {
  calls.length = 0;
});

describe("GET /api/ads", () => {
  const query = { page: 1, limit: 20, status: "deleted" };

  it("гостю и жителю отдаёт только активные", async () => {
    for (const user of [null, { user_id: 5n, roles: [] }]) {
      await respond(controller.getAds, { query, user });
    }

    expect(calls.map((call) => call.filters.status)).toEqual(["active", "active"]);
  });

  it("модератор может посмотреть и снятые объявления", async () => {
    await respond(controller.getAds, {
      query,
      user: { user_id: 1n, roles: ["global:moderator"] },
    });

    expect(calls[0].filters.status).toBe("deleted");
  });

  it("фильтры панели поиска проходят валидацию обоих списков", () => {
    // Фронт шлёт один и тот же набор и на витрину, и на «Мои объявления».
    const filters = {
      category: "2",
      subcategory: "21",
      search: "диван",
      priceMin: "100",
      priceMax: "5000",
      dateFrom: "2026-09-01T00:00:00.000Z",
      dateTo: "2026-09-30T23:59:59.999Z",
      sort: "price",
      order: "ASC",
      page: "2",
      limit: "20",
    };

    for (const schema of [getAdsQuerySchema, userAdsQuerySchema]) {
      const { error, value } = schema.validate(filters);
      expect(error?.message).toBeUndefined();
      expect(value.priceMin).toBe(100);
    }
  });
});

describe("GET /api/ads/:id", () => {
  it("передаёт смотрителя в кейс, а не решает сам", async () => {
    const viewer = { user_id: 7n, roles: [] };
    await respond(controller.getAdById, { params: { id: "3" }, user: viewer });

    expect(calls[0]).toMatchObject({ method: "getAdById", id: 3, increment: false, viewer });
  });

  it("без токена смотритель — null", async () => {
    await respond(controller.getAdById, { params: { id: "3" }, user: undefined });

    expect(calls[0].viewer).toBeNull();
  });
});
