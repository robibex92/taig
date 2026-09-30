import { jest, describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Выборка объявлений для витрины и «Моих объявлений».
 *
 * Прод-БД с этой машины недоступна, поэтому вместо неё — подставка `prisma`,
 * которая записывает, какие аргументы у неё спросили. Проверяем договорённости,
 * которые легко сломать и дорого заметить на проде: белый список полей
 * сортировки, честный `total` при сортировке по строковой цене и то, что
 * сводка по состояниям считает всех, а не одну страницу.
 */

const rows = (n, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: BigInt(offset + i + 1),
    title: `Объявление ${offset + i + 1}`,
    price: null,
    status: "active",
    user_id: 7n,
    category: null,
    subcategory: null,
  }));

const prisma = {
  // `$transaction([...])` в Prisma принимает массив запросов — здесь он и
  // используется, когда список и счётчик читаются одним обращением.
  $transaction: (operations) => Promise.all(operations),
  ad: {
    findMany: jest.fn(async (args) => rows(args.take ?? 3, args.skip ?? 0)),
    count: jest.fn(async () => 41),
    groupBy: jest.fn(async () => [
      { status: "active", _count: { _all: 3 }, _sum: { view_count: 120 } },
      { status: "archive", _count: { _all: 2 }, _sum: { view_count: 30 } },
      { status: "deleted", _count: { _all: 1 }, _sum: { view_count: null } },
      { status: "unknown_status", _count: { _all: 9 }, _sum: { view_count: 9 } },
    ]),
  },
  adImage: { findMany: jest.fn(async () => []) },
  category: { findMany: jest.fn(async () => [{ id: 5n, name: "Транспорт" }]) },
  subcategory: { findMany: jest.fn(async () => [{ id: 9n, name: "Велосипеды" }]) },
};

await jest.unstable_mockModule(
  "../../../infrastructure/database/prisma.js",
  () => ({ prisma })
);

const { AdRepository } = await import(
  "../../../infrastructure/repositories/AdRepository.js"
);

const repository = new AdRepository();

beforeEach(() => {
  prisma.ad.findMany.mockClear();
  prisma.ad.count.mockClear();
  prisma.ad.groupBy.mockClear();
  prisma.adImage.findMany.mockClear();
  prisma.category.findMany.mockClear();
  prisma.subcategory.findMany.mockClear();
});

describe("sortBy whitelist", () => {
  it("неизвестное поле сортировки не уходит в SQL", () => {
    const orderBy = repository._orderBy("password; DROP TABLE ads", "asc");
    expect(orderBy).toEqual({ created_at: "asc" });
  });

  it("известное поле сортировки проходит", () => {
    expect(repository._orderBy("price", "desc")).toEqual({ price: "desc" });
  });
});

describe("findByUserId", () => {
  it("читает страницу и отдаёт total со всей выборки", async () => {
    const { ads, total } = await repository.findByUserId(7, {
      status: "archive",
      category: 5,
      search: "диван",
      sort: "created_at",
      order: "ASC",
      limit: 3,
      offset: 6,
    });

    const findMany = prisma.ad.findMany.mock.calls[0][0];

    expect(findMany).toMatchObject({ skip: 6, take: 3 });
    expect(findMany.where).toMatchObject({
      user_id: 7n,
      status: "archive",
      category: 5,
    });
    expect(findMany.where.OR[0].title.contains).toBe("диван");
    expect(findMany.orderBy).toEqual({ created_at: "asc" });
    expect(total).toBe(41);
    expect(ads).toHaveLength(3);
  });

  it("страницы без limit не существует: сервер режет сам", async () => {
    await repository.findByUserId(7, {});

    const findMany = prisma.ad.findMany.mock.calls[0][0];
    expect(findMany.skip).toBeUndefined();
    expect(findMany.take).toBeUndefined();
  });

  it("сортировка по цене считается в JS, total — по всему списку", async () => {
    prisma.ad.findMany.mockResolvedValueOnce([
      { id: 1n, price: "10000", status: "active" },
      { id: 2n, price: "900", status: "active" },
      { id: 3n, price: "Договорная", status: "active" },
      { id: 4n, price: "50", status: "active" },
    ]);

    const { ads, total } = await repository.findByUserId(7, {
      sort: "price",
      order: "ASC",
      limit: 2,
      offset: 0,
    });

    expect(total).toBe(4);
    // Лексикографически было бы «10000, 50, 900»; без цены — в конце.
    expect(ads.map((ad) => ad.price)).toEqual(["50", "900"]);
  });

  it("картинки и названия категорий дотягиваются пачкой на страницу", async () => {
    prisma.ad.findMany.mockResolvedValueOnce([
      { id: 1n, category: 5n, subcategory: 9n, status: "active" },
      { id: 2n, category: 5n, subcategory: null, status: "active" },
    ]);

    const { ads } = await repository.findByUserId(7, {});

    // Один запрос на все картинки страницы, а не по запросу на карточку.
    expect(prisma.adImage.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.adImage.findMany.mock.calls[0][0].where.ad_id.in).toEqual([1, 2]);
    expect(ads[0].category_name).toBe("Транспорт");
    expect(ads[0].subcategory_name).toBe("Велосипеды");
    expect(ads[1].subcategory_name).toBeNull();
  });
});

describe("summarizeForUser", () => {
  it("считает состояния, всего и просмотры по всем объявлениям", async () => {
    const summary = await repository.summarizeForUser(7, { category: 5 });

    const args = prisma.ad.groupBy.mock.calls[0][0];
    expect(args.where).toMatchObject({ user_id: 7n, category: 5 });
    expect(args.where.status).toBeUndefined();

    expect(summary).toEqual({
      byStatus: { active: 3, archive: 2, deleted: 1, draft: 0 },
      total: 15,
      totalViews: 159,
    });
  });
});
