import { jest, describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Выборка объявлений для витрины и «Моих объявлений».
 *
 * Прод-БД с этой машины недоступна, поэтому вместо неё — подставка `prisma`,
 * которая записывает, какие аргументы у неё спросили. Проверяем договорённости,
 * которые легко сломать и дорого заметить на проде: белый список полей
 * сортировки, что цена фильтруется и сортируется в SQL по `price_value`, `total`
 * приходит из `count`, а сводка по состояниям считает всех, а не одну страницу.
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
  // используется, когда список и счётчик читаются одним обращением. Формой с
  // колбэком идут создание и правка: транзакция пишет и картинки, и саму строку.
  $transaction: (operations) =>
    typeof operations === "function" ? operations(prisma) : Promise.all(operations),
  ad: {
    findMany: jest.fn(async (args) => rows(args.take ?? 3, args.skip ?? 0)),
    count: jest.fn(async () => 41),
    groupBy: jest.fn(async () => []),
    create: jest.fn(async ({ data }) => ({ id: 101n, ...data })),
    update: jest.fn(async ({ data }) => ({ id: 101n, ...data })),
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
  prisma.ad.create.mockClear();
  prisma.ad.update.mockClear();
  prisma.adImage.findMany.mockClear();
  prisma.category.findMany.mockClear();
  prisma.subcategory.findMany.mockClear();
});

describe("sortBy whitelist", () => {
  it("неизвестное поле сортировки не уходит в SQL", () => {
    const orderBy = repository._orderBy("password; DROP TABLE ads", "asc");
    expect(orderBy).toEqual({ created_at: "asc" });
  });

  it("цена сортируется по числовой колонке, без цены — в конце", () => {
    expect(repository._orderBy("price", "desc")).toEqual({
      price_value: { sort: "desc", nulls: "last" },
    });
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

  it("порядок и диапазон цены уходят в SQL, total — из count", async () => {
    const { total } = await repository.findByUserId(7, {
      sort: "price",
      order: "ASC",
      priceMin: 500,
      priceMax: 9000,
      limit: 2,
      offset: 0,
    });

    const findMany = prisma.ad.findMany.mock.calls[0][0];

    // «10000» раньше вставала перед «900»: строку сравнивали лексикографически.
    expect(findMany.orderBy).toEqual({ price_value: { sort: "asc", nulls: "last" } });
    expect(findMany.where.price_value).toEqual({ not: null, gte: 500, lte: 9000 });
    // `total` — со всей выборки, а не с того, что осталось после среза.
    expect(total).toBe(41);
    expect(prisma.ad.count.mock.calls[0][0].where.price_value).toMatchObject({
      not: null,
      gte: 500,
    });
  });

  it("картинки и названия категорий дотягиваются пачкой на страницу", async () => {    prisma.ad.findMany.mockResolvedValueOnce([
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

describe("фильтр по авторам (объявления моего дома)", () => {
  it("список id авторов уходит в SQL, total — по тому же where", async () => {
    await repository.findAll({ authorIds: [11n, 12n] }, { page: 1, limit: 20 });

    const findMany = prisma.ad.findMany.mock.calls[0][0];
    expect(findMany.where.user_id).toEqual({ in: [11n, 12n] });
    expect(prisma.ad.count.mock.calls[0][0].where.user_id).toEqual({ in: [11n, 12n] });
  });

  it("пустой список авторов не превращается в «без фильтра»", async () => {
    await repository.findAll({ authorIds: [] }, { page: 1, limit: 20 });

    expect(prisma.ad.findMany.mock.calls[0][0].where.user_id).toEqual({ in: [] });
  });

  it("без фильтра авторов `user_id` в where не появляется", async () => {
    await repository.findAll({ status: "active" }, { page: 1, limit: 20 });

    expect(prisma.ad.findMany.mock.calls[0][0].where.user_id).toBeUndefined();
  });
});

describe("тип предложения и срок", () => {
  const base = { user_id: 7, title: "Дрель", content: "Аккумуляторная", category: 5 };

  it("прокат сохраняется со сроком", async () => {
    await repository.create({ ...base, offer_type: "rent", rental_days: 3 });

    expect(prisma.ad.create.mock.calls[0][0].data).toMatchObject({
      offer_type: "rent",
      rental_days: 3,
    });
  });

  it("продажа не держит срок, даже если его прислали", async () => {
    await repository.create({ ...base, offer_type: "sale", rental_days: 5 });

    expect(prisma.ad.create.mock.calls[0][0].data.rental_days).toBeNull();
  });

  it("правка «прокат → продажа» снимает срок тем же запросом", async () => {
    await repository.update(101, { offer_type: "sale", rental_days: null });

    expect(prisma.ad.update.mock.calls[0][0].data).toMatchObject({
      offer_type: "sale",
      rental_days: null,
    });
  });

  it("правка без типа не трогает ни тип, ни срок", async () => {
    await repository.update(101, { title: "Дрель Bosch" });

    const data = prisma.ad.update.mock.calls[0][0].data;
    expect(data.title).toBe("Дрель Bosch");
    expect(data.offer_type).toBeUndefined();
    expect(data.rental_days).toBeUndefined();
  });
});

describe("summarizeForUser", () => {
  const groups = [
    { status: "active", _count: { _all: 2 }, _sum: { view_count: 120 } },
    { status: "archive", _count: { _all: 1 }, _sum: { view_count: 30 } },
    { status: "deleted", _count: { _all: 1 }, _sum: { view_count: null } },
    { status: "unknown_status", _count: { _all: 1 }, _sum: { view_count: 9 } },
  ];

  it("считает состояния, всего и просмотры по всем объявлениям", async () => {
    prisma.ad.groupBy.mockResolvedValueOnce(groups);

    const summary = await repository.summarizeForUser(7, { category: 5 });

    const args = prisma.ad.groupBy.mock.calls[0][0];
    expect(args.where).toMatchObject({ user_id: 7n, category: 5 });
    expect(args.where.status).toBeUndefined();

    // Состояние, которого в словаре нет, в счётчики не попадает, но в `total`
    // остаётся: объявление существует и скрывать его нельзя.
    expect(summary).toEqual({
      byStatus: { active: 2, archive: 1, deleted: 1, draft: 0 },
      total: 5,
      totalViews: 159,
    });
  });

  it("учитывает фильтр по цене, как и список", async () => {
    prisma.ad.groupBy.mockResolvedValueOnce([groups[1]]);

    const summary = await repository.summarizeForUser(7, {
      priceMin: 60,
      priceMax: 200,
    });

    // Сводка идёт по тому же `where`, что и список: чипы вкладок не обещают
    // число всех объявлений под отфильтрованной пустотой.
    expect(prisma.ad.groupBy.mock.calls[0][0].where.price_value).toEqual({
      not: null,
      gte: 60,
      lte: 200,
    });
    expect(summary.byStatus).toEqual({ active: 0, archive: 1, deleted: 0, draft: 0 });
    expect(summary.total).toBe(1);
    expect(summary.totalViews).toBe(30);
  });
});
