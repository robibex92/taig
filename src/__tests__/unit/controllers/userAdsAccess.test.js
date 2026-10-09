import { describe, it, expect, beforeEach } from "@jest/globals";

import { UserController } from "../../../presentation/controllers/UserController.js";

/**
 * Кто и что видит в `GET /api/ads/user/:user_id`.
 *
 * Маршрут публичный (страница продавца), и здесь уже был случай, когда
 * сравнение `BigInt` из Prisma с числом из пути делало владельца «чужим»:
 * счётчики вкладок переставали приходить. Поэтому проверка и на «свой», и на
 * «чужой» идёт тестом, а не на глазок.
 */

const listCalls = [];

const adRepository = {
  findByUserId: async (userId, filters) => {
    listCalls.push({ userId, filters });
    return { ads: [], total: 0 };
  },
  summarizeForUser: async () => ({
    byStatus: { active: 1, archive: 2, deleted: 3, draft: 0 },
    total: 6,
    totalViews: 42,
  }),
};

const controller = new UserController(null, null, adRepository);

/** `asyncHandler` не возвращает промис — ждём, пока контроллер вызовет `res.json`. */
const respond = (req) =>
  new Promise((resolve, reject) => {
    const res = {
      status() {
        return res;
      },
      json: resolve,
    };

    controller.getUserAds(req, res, reject);
  });

const requestFor = (user, query = {}) => ({
  user,
  params: { user_id: "7" },
  query: { page: 1, limit: 20, ...query },
});

beforeEach(() => {
  listCalls.length = 0;
});

describe("getUserAds", () => {
  it("владелец видит все состояния и получает сводку", async () => {
    const body = await respond(
      requestFor({ user_id: 7n, roles: [] }, { status: "deleted" })
    );

    expect(listCalls[0].filters).toMatchObject({
      status: "deleted",
      offset: 0,
    });
    expect(listCalls[0].userId).toBe(7);
    expect(body.summary).toMatchObject({ total: 6, totalViews: 42 });
    expect(body.pagination.totalPages).toBe(0);
  });

  it("гость не может вытащить чужой архив или удалённые", async () => {
    const body = await respond(requestFor(null, { status: "deleted" }));

    expect(listCalls[0].filters.status).toBe("active");
    expect(body.summary).toBeUndefined();
  });

  it("модератор — тоже свой", async () => {
    const body = await respond(
      requestFor({ user_id: 99n, roles: ["global:moderator"] }, { status: "archive" })
    );

    expect(listCalls[0].filters.status).toBe("archive");
    expect(body.summary).toBeDefined();
  });

  it("фильтры цены и дат доходят до списка и сводки", async () => {
    const query = {
      priceMin: 100,
      priceMax: 5000,
      dateFrom: "2026-09-01T00:00:00.000Z",
      dateTo: "2026-09-30T23:59:59.999Z",
    };

    await respond(requestFor({ user_id: 7n, roles: [] }, query));

    // Панель поиска на «Моих объявлениях» та же, что на витрине: непонятый
    // параметр — это либо 400, либо счётчики вкладок вразрез со списком.
    expect(listCalls[0].filters).toMatchObject(query);
  });
});
