/* eslint-env jest */
/**
 * Комментарий «i» на «Привет, сосед» адресуется зданию, а не квартире.
 *
 * `houses` — таблица квартир: под одним номером столько строк, сколько квартир.
 * Строки комментариев легли на разные из них (проверено на проде 15.10.2026:
 * у дома `39` они стоят на id 2, 6 и 39), поэтому читать надо по всем id номера.
 *
 * Второй ловушкой был `isNaN` в контроллере: номер «37» — это число, и запрос
 * уходил в поиск по `house_id = 37`, то есть по id квартиры (которая у нас
 * относится к дому 39). Дома с дробью работали, дома без неё — нет.
 */

import { NotFoundError, ValidationError } from "../../../core/errors/AppError.js";
import { GetHouseCommentsUseCase } from "../../../application/use-cases/houseComment/GetHouseCommentsUseCase.js";
import { GetEntranceCommentUseCase } from "../../../application/use-cases/entranceComment/GetEntranceCommentUseCase.js";

// Срез проде: id квартир по номеру дома.
const HOUSE_ROWS = {
  "37": [527n],
  "37/1": [1039n],
  "39": [2n, 6n, 39n],
  "39/1": [754n],
};

const HOUSE_COMMENTS = [
  { id: 1n, house_id: 39n, comment: "чат дома 39", created_at: new Date("2026-01-01") },
  { id: 2n, house_id: 527n, comment: "чат дома 37", created_at: new Date("2026-01-02") },
  { id: 3n, house_id: 754n, comment: "чат дома 39/1", created_at: new Date("2026-01-03") },
  { id: 12n, house_id: 2n, comment: "чат дома 39, квартира 1", created_at: new Date("2026-01-04") },
  { id: 13n, house_id: 1039n, comment: "чат дома 37/1", created_at: new Date("2026-01-05") },
  // Самая свежая строка дома 39 примотана к квартире 5 — её обязано быть видно.
  { id: 14n, house_id: 6n, comment: "чат дома 39, последний", created_at: new Date("2026-01-06") },
];

const ENTRANCE_COMMENTS = [
  { id: 3n, house_id: 39n, entrance: 1, comment: "39, секция 1", created_at: new Date("2026-01-01") },
  { id: 9n, house_id: 37n, entrance: 1, comment: "легаси: номер 37 в house_id", created_at: new Date("2026-01-02") },
  { id: 10n, house_id: 1039n, entrance: 1, comment: "37/1, секция 1", created_at: new Date("2026-01-03") },
  { id: 11n, house_id: 754n, entrance: 1, comment: "39/1, секция 1", created_at: new Date("2026-01-04") },
  { id: 13n, house_id: 527n, entrance: 1, comment: "37, секция 1", created_at: new Date("2026-01-05") },
];

const houseCommentRepository = {
  findByHouseNumber: async (houseNumber) => {
    const ids = HOUSE_ROWS[String(houseNumber)] ?? [];
    return HOUSE_COMMENTS.filter((c) => ids.includes(c.house_id)).sort(
      (a, b) => b.created_at - a.created_at
    );
  },
  findByHouseId: async (house_id) =>
    HOUSE_COMMENTS.filter((c) => c.house_id === BigInt(house_id)),
  findSimpleCommentByHouseNumber: async (houseNumber) => {
    const comments = await houseCommentRepository.findByHouseNumber(houseNumber);
    return comments.length ? comments[0].comment : null;
  },
};

const useCase = new GetHouseCommentsUseCase(houseCommentRepository);

const entranceRepository = {
  findByHouseIdsAndEntrance: async (house_ids, entrance) =>
    ENTRANCE_COMMENTS.filter(
      (e) => house_ids.includes(e.house_id) && e.entrance === Number(entrance)
    ).sort((a, b) => b.created_at - a.created_at)[0] ?? null,
};

const entranceUseCase = new GetEntranceCommentUseCase(entranceRepository, {
  findIdsByHouseNumber: async (houseNumber) => HOUSE_ROWS[String(houseNumber).trim()] ?? [],
});

describe("комментарии дома — по номеру, а не по id квартиры", () => {
  it("дом без дроби видит свои комментарии", async () => {
    const comments = await useCase.executeByNumber("37");

    expect(comments.map((c) => c.comment)).toEqual(["чат дома 37"]);
  });

  it("дом видит строки, примотанные к разным квартирам одного здания", async () => {
    const comments = await useCase.executeByNumber("39");

    expect(comments.map((c) => c.comment)).toEqual([
      "чат дома 39, последний",
      "чат дома 39, квартира 1",
      "чат дома 39",
    ]);
  });

  it("тултип показывает последний комментарий дома", async () => {
    expect(await useCase.executeSimple("39")).toBe("чат дома 39, последний");
    expect(await useCase.executeSimple("39/1")).toBe("чат дома 39/1");
  });

  it("37 и 37/1 — разные здания", async () => {
    expect(await useCase.executeSimple("37")).toBe("чат дома 37");
    expect(await useCase.executeSimple("37/1")).toBe("чат дома 37/1");
  });

  it("номер дома не трактуется как id квартиры", async () => {
    // Именно так выглядел сломанный путь: `house_id = 37` — это квартира дома 39.
    const asRowId = await useCase.execute("37");
    expect(asRowId).toEqual([]);

    expect(await useCase.executeByNumber("37")).not.toEqual([]);
  });
});

describe("комментарий подъезда", () => {
  it("читается по всем квартирам своего дома", async () => {
    const result = await entranceUseCase.execute("39", 1);

    expect(result).toMatchObject({ house: "39", entrance: 1, comment: "39, секция 1" });
  });

  it("не подтягивает чужой дом по совпадению номера с id квартиры", async () => {
    // Легаси-строка 9 лежит на houses.id = 37 — это квартира дома 39.
    const result = await entranceUseCase.execute("37", 1);

    expect(result.comment).toBe("37, секция 1");
  });

  it("дом с дробью получает только свой текст", async () => {
    expect((await entranceUseCase.execute("37/1", 1)).comment).toBe("37/1, секция 1");
    expect((await entranceUseCase.execute("39/1", 1)).comment).toBe("39/1, секция 1");
  });

  it("пусто, если у подъезда комментария нет", async () => {
    expect(await entranceUseCase.execute("37/1", 4)).toMatchObject({ comment: null });
  });

  it("неизвестный дом и битый подъезд — ошибки, а не чужие данные", async () => {
    await expect(entranceUseCase.execute("41", 1)).rejects.toBeInstanceOf(NotFoundError);
    await expect(entranceUseCase.execute("37", 0)).rejects.toBeInstanceOf(ValidationError);
  });
});
