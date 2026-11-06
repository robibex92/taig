/* eslint-env jest */
/**
 * Кому достаются персональные поля домов.
 *
 * Четыре публичных эндпоинта по отдельности выглядят безобидно, а вместе
 * собирали карту дома: квартира ↔ Telegram-id жильца ↔ ник ↔ текст домашнего
 * чата. Теперь уровень выдачи решает сервер по смотрителю запроса — по тому же
 * правилу, по которому уже работает парковка.
 */

import { GetHousesByFilterUseCase } from "../../../application/use-cases/house/GetHousesByFilterUseCase.js";
import { GetHouseCommentsUseCase } from "../../../application/use-cases/houseComment/GetHouseCommentsUseCase.js";
import { GetEntranceCommentUseCase } from "../../../application/use-cases/entranceComment/GetEntranceCommentUseCase.js";
import { House } from "../../../domain/entities/House.entity.js";
import { NotFoundError } from "../../../core/errors/AppError.js";

const guest = null;
const resident = { user_id: 8n, roles: ["house:39:view"] };
const manager = { user_id: 9n, roles: ["house:39:manage"] };
const neighbour = { user_id: 10n, roles: ["house:37:view"] };
const moderator = { user_id: 1n, roles: ["global:moderator"] };

const apartmentRows = [
  new House({ id: 2, house: "39", number: "12", floor: 3, position: 0, id_telegram: 245946670, info: "есть кот" }),
  new House({ id: 6, house: "39", number: "13", floor: 3, position: 1, id_telegram: null, info: null }),
];

const houseRepository = {
  findByFilters: async () => apartmentRows,
  findByHouseNumber: async (number) =>
    number === "39" || number === "39/1"
      ? { id: 2n, house: String(number) }
      : null,
};

const commentRows = [
  { id: 1n, house_id: 2n, house_number: "39", comment: "В чат 39 добавляет @lissa_1313", created_at: new Date("2026-01-01") },
];

const commentRepository = {
  findByHouseNumber: async () => commentRows,
  findByHouseId: async () => commentRows,
  findSimpleCommentByHouseNumber: async () => commentRows[0].comment,
};

const entranceRepository = {
  findByHouseNumberAndEntrance: async () => ({ comment: "чат первой секции" }),
};

describe("сетка квартир (`GET /api/nearby`)", () => {
  const useCase = new GetHousesByFilterUseCase(houseRepository);

  it("гость не получает `id_telegram` ни одной квартиры", async () => {
    const houses = await useCase.execute({ house: "39" }, guest);

    expect(houses).toHaveLength(2);
    houses.forEach((row) => expect(row).not.toHaveProperty("id_telegram"));
    // Всё, что нужно витрине, остаётся.
    expect(houses[0]).toMatchObject({ id: 2, number: "12", floor: 3, hasInfo: true });
  });

  it("жильцу с ролью дома и держателю manage — контакт виден", async () => {
    for (const viewer of [resident, manager, moderator]) {
      const houses = await useCase.execute({ house: "39" }, viewer);

      expect(houses[0].id_telegram).toBe(245946670);
      // Квартира без жильца остаётся без id, а не с `null` вместо адреса.
      expect(houses[1]).not.toHaveProperty("id_telegram");
    }
  });

  it("сосед другого дома чужого контакта не видит", async () => {
    const houses = await useCase.execute({ house: "39" }, neighbour);

    expect(houses[0]).not.toHaveProperty("id_telegram");
  });
});

describe("комментарий дома", () => {
  const useCase = new GetHouseCommentsUseCase(commentRepository);

  it("текст знает только тот, кому открыт дом", async () => {
    expect(await useCase.executeByNumber("39", guest)).toEqual([]);
    expect(await useCase.executeByNumber("39", neighbour)).toEqual([]);
    expect(await useCase.executeByNumber("39", resident)).toHaveLength(1);
    expect(await useCase.executeByNumber("39", moderator)).toHaveLength(1);
  });

  it("короткий вариант отвечает пустотой, а не ошибкой", async () => {
    expect(await useCase.executeSimple("39", guest)).toBeNull();
    expect(await useCase.executeSimple("39", resident)).toBe(commentRows[0].comment);
  });

  it("чтение по id записи проверяет номер дома из строки, а не из запроса", async () => {
    expect(await useCase.execute("2", guest)).toEqual([]);
    expect(await useCase.execute("2", resident)).toHaveLength(1);
  });

  it("дома без комментариев не каскадом не открывается", async () => {
    const empty = new GetHouseCommentsUseCase({
      findByHouseNumber: async () => [],
      findByHouseId: async () => [],
      findSimpleCommentByHouseNumber: async () => null,
    });

    expect(await empty.executeByNumber("41", guest)).toEqual([]);
  });
});

describe("комментарий подъезда", () => {
  const useCase = new GetEntranceCommentUseCase(entranceRepository, houseRepository);

  it("гостю — `comment: null`, без ошибки и без подсказки", async () => {
    const result = await useCase.execute("39", 1, guest);

    expect(result).toEqual({ house: "39", entrance: 1, comment: null });
  });

  it("жильцу дома и модерации — текст", async () => {
    for (const viewer of [resident, moderator]) {
      const result = await useCase.execute("39", 1, viewer);

      expect(result.comment).toBe("чат первой секции");
    }
  });

  it("проверка идёт до чтения комментария", async () => {
    let read = 0;
    const counted = new GetEntranceCommentUseCase(
      {
        findByHouseNumberAndEntrance: async () => {
          read += 1;
          return { comment: "текст" };
        },
      },
      houseRepository
    );

    await counted.execute("39", 1, guest);
    await counted.execute("39", 2, resident);
    expect(read).toBe(1);

    // Несуществующий дом — по-прежнему 404, а не пустой комментарий.
    await expect(counted.execute("41", 1, guest)).rejects.toBeInstanceOf(NotFoundError);
  });
});
