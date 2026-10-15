/* eslint-env jest */
/**
 * Правило, сформулированное пользователем: открыли дом 39 — комментарий дома 39;
 * открыли первый подъезд дома 39/1 — комментарий первого подъезда 39/1.
 *
 * Раньше адресом служил `house_id` — id конкретной квартиры из `houses`, и текст
 * уезжал вместе с квартирой: прод отдавал «чат 1 секции дома 37/1», когда открывали
 * первый подъезд дома 39 (проверено 15.10.2026). Теперь адрес — `house_number`.
 */

import { NotFoundError, ValidationError } from "../../../core/errors/AppError.js";
import { GetHouseCommentsUseCase } from "../../../application/use-cases/houseComment/GetHouseCommentsUseCase.js";
import { GetEntranceCommentUseCase } from "../../../application/use-cases/entranceComment/GetEntranceCommentUseCase.js";
import { CreateEntranceCommentUseCase } from "../../../application/use-cases/entranceComment/CreateEntranceCommentUseCase.js";

// Номера домов ↔ id их квартир (срез проде 15.10.2026).
const HOUSE_ROWS = {
  "37": [527n],
  "37/1": [1039n],
  "39": [2n, 6n, 37n, 39n],
  "39/1": [754n],
};

const byId = (rows) => rows[0];

// `house_id` у строк нарочно разбросан по квартирам — в том числе чужими: читать
// по нему больше нельзя.
const HOUSE_COMMENTS = [
  { id: 1n, house_id: 39n, house_number: "39", comment: "чат дома 39", created_at: new Date("2026-01-01") },
  { id: 2n, house_id: 527n, house_number: "37", comment: "чат дома 37", created_at: new Date("2026-01-02") },
  { id: 3n, house_id: 754n, house_number: "39/1", comment: "чат дома 39/1", created_at: new Date("2026-01-03") },
  { id: 12n, house_id: 2n, house_number: "39", comment: "чат дома 39, квартира 1", created_at: new Date("2026-01-04") },
  { id: 13n, house_id: 1039n, house_number: "37/1", comment: "чат дома 37/1", created_at: new Date("2026-01-05") },
  { id: 14n, house_id: 6n, house_number: "39", comment: "чат дома 39, последний", created_at: new Date("2026-01-06") },
];

const ENTRANCE_COMMENTS = [
  { id: 3n, house_id: 39n, house_number: "39", entrance: 1, comment: "39, секция 1", created_at: new Date("2026-01-01") },
  // Тот самый прод-случай: строка лежит на квартире дома 39, но относится к 37/1.
  { id: 9n, house_id: 37n, house_number: "37/1", entrance: 1, comment: "37/1, секция 1", created_at: new Date("2026-01-02") },
  { id: 10n, house_id: 1039n, house_number: "37/1", entrance: 1, comment: "37/1, секция 1, дубль", created_at: new Date("2026-01-03") },
  { id: 11n, house_id: 754n, house_number: "39/1", entrance: 1, comment: "39/1, секция 1", created_at: new Date("2026-01-04") },
  { id: 13n, house_id: 527n, house_number: "37", entrance: 1, comment: "37, секция 1", created_at: new Date("2026-01-05") },
];

const houseCommentRepository = {
  findByHouseNumber: async (house_number) =>
    HOUSE_COMMENTS.filter((c) => c.house_number === String(house_number)).sort(
      (a, b) => b.created_at - a.created_at
    ),
  findByHouseId: async (house_id) =>
    HOUSE_COMMENTS.filter((c) => c.house_id === BigInt(house_id)),
  findSimpleCommentByHouseNumber: async (house_number) => {
    const comments = await houseCommentRepository.findByHouseNumber(house_number);
    return comments.length ? comments[0].comment : null;
  },
};

const useCase = new GetHouseCommentsUseCase(houseCommentRepository);

const entranceRepository = {
  findByHouseNumberAndEntrance: async (house_number, entrance) =>
    ENTRANCE_COMMENTS.filter(
      (e) => e.house_number === String(house_number) && e.entrance === Number(entrance)
    ).sort((a, b) => b.created_at - a.created_at)[0] ?? null,
  create: async (data) => ({ id: 99n, ...data }),
};

const houseRepository = {
  findByHouseNumber: async (house_number) => {
    const ids = HOUSE_ROWS[String(house_number)];
    return ids ? { id: byId(ids), house: String(house_number) } : null;
  },
};

const entranceUseCase = new GetEntranceCommentUseCase(entranceRepository, houseRepository);

describe("комментарий дома принадлежит номеру дома", () => {
  it("дом без дроби видит свои строки, на каких бы квартирах они ни лежали", async () => {
    expect(await useCase.executeByNumber("39")).toHaveLength(3);
    expect(await useCase.executeSimple("39")).toBe("чат дома 39, последний");
    expect(await useCase.executeSimple("37")).toBe("чат дома 37");
  });

  it("39 и 39/1 — разные здания", async () => {
    expect(await useCase.executeSimple("39/1")).toBe("чат дома 39/1");
    expect(await useCase.executeSimple("37/1")).toBe("чат дома 37/1");
  });

  it("номер дома не трактуется как id квартиры", async () => {
    // Сломанный путь: `house_id = 39` — одна квартира дома 39, а не весь дом.
    const asRowId = await useCase.execute("39");
    expect(asRowId.map((c) => c.comment)).toEqual(["чат дома 39"]);

    expect(await useCase.executeByNumber("39")).toHaveLength(3);
  });
});

describe("комментарий подъезда", () => {
  it("открыли первый подъезд дома 39 — текст дома 39", async () => {
    const result = await entranceUseCase.execute("39", 1);

    expect(result).toMatchObject({ house: "39", entrance: 1, comment: "39, секция 1" });
  });

  it("открыли первый подъезд дома 39/1 — текст дома 39/1", async () => {
    expect((await entranceUseCase.execute("39/1", 1)).comment).toBe("39/1, секция 1");
    expect((await entranceUseCase.execute("37/1", 1)).comment).toBe("37/1, секция 1, дубль");
  });

  it("квартира чужого дома под текстом ничего не меняет", async () => {
    // 37/1 живёт на houses.id = 37 и 1039, при этом 37 — квартира дома 39.
    expect((await entranceUseCase.execute("39", 1)).comment).not.toMatch(/37/);
  });

  it("пусто, если у подъезда комментария нет", async () => {
    expect(await entranceUseCase.execute("37/1", 4)).toMatchObject({ comment: null });
  });

  it("неизвестный дом и битый подъезд — ошибки, а не чужие данные", async () => {
    await expect(entranceUseCase.execute("41", 1)).rejects.toBeInstanceOf(NotFoundError);
    await expect(entranceUseCase.execute("37", 0)).rejects.toBeInstanceOf(ValidationError);
  });

  it("новый комментарий записывается с номером дома", async () => {
    const created = [];
    const writer = new CreateEntranceCommentUseCase(
      { create: async (data) => (created.push(data), { id: 100n, ...data }) },
      houseRepository
    );

    await writer.execute({
      house_id: "39/1",
      entrance: "2",
      author_id: 7,
      comment: "чат второй секции",
      user: { user_id: 7n, roles: ["global:admin"] },
    });

    expect(created[0]).toMatchObject({
      house_number: "39/1",
      house_id: 754n,
      entrance: 2,
    });
  });
});
