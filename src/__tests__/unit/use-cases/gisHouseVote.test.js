/* eslint-env jest */
/**
 * Кому показывать голоса соседей на сетке квартир.
 *
 * Право ровно то же, что у текста квартиры: `canViewHouse` — глобальная
 * модерация и держатели `house:<номер>:view|manage`. Чужой дом, сосед другого
 * подъезда и аноним получают `null`: не «скрыто, видно только старшему», а
 * просто нет данных, из которых интерфейс что-либо рисует.
 */

import { describe, expect, it } from "@jest/globals";
import { GisHouseVoteUseCase } from "../../../application/use-cases/gisVote/GisHouseVoteUseCase.js";

const report = (overrides = {}) => ({
  id: 1n,
  house: "39",
  title: "ОСС 2026, кровля",
  exported_at: new Date("2026-10-26T00:00:00.000Z"),
  rooms_total: 2,
  rooms_base: 2,
  rooms_voted: 1,
  area_base: "69.10",
  weight_voted: "23.60",
  rooms: [
    {
      id: 1n,
      cadastre: "54:35:041122:1161",
      room_label: "103",
      kind: "apartment",
      owners: 1,
      area: "23.60",
      weight: "23.60",
      voted: true,
    },
    {
      id: 2n,
      cadastre: "54:35:041122:1162",
      room_label: "104",
      kind: "apartment",
      owners: 2,
      area: "45.50",
      weight: "0.00",
      voted: false,
    },
  ],
  ...overrides,
});

const build = ({ slice = report(), apartments = [103, 104, 105] } = {}) => {
  const calls = [];

  const useCase = new GisHouseVoteUseCase({
    reports: {
      async latestSliceByHouse(house) {
        calls.push(house);

        return slice;
      },
    },
    houses: {
      async findByFilters(filters) {
        calls.push(JSON.stringify(filters));

        return apartments.map((number, index) => ({ id: BigInt(index + 1), number }));
      },
    },
  });

  return { useCase, calls };
};

const staff = (roles) => ({ user_id: 1n, roles });

describe("наложение среза на сетку по правам", () => {
  it("старшему по дому данные открыты, гостю и соседу другого дома — null", async () => {
    const { useCase } = build();

    for (const roles of [["house:39:view"], ["house:39:manage"], ["global:moderator"], ["global:admin"]]) {
      const result = await useCase.execute({ house: "39", viewer: staff(roles) });

      expect(result?.slice?.title).toBe("ОСС 2026, кровля");
      expect(result.cells.map((cell) => [cell.number, cell.voted])).toEqual([
        ["103", true],
        ["104", false],
      ]);
    }

    for (const viewer of [null, staff(["house:39/1:view"]), staff([]), staff(["global:resident"])]) {
      expect(await useCase.execute({ house: "39", viewer })).toBeNull();
    }
  });

  it("без сохранённого среза ответа нет, и квартиры не читаются зря", async () => {
    const { useCase, calls } = build({ slice: null });

    expect(await useCase.execute({ house: "39", viewer: staff(["house:39:view"]) })).toBeNull();
    expect(calls).toEqual(["39"]);
  });

  it("дом читается ровно тот, что спросили: 39 и 39/1 — разные права и разные дома", async () => {
    const { useCase, calls } = build();

    await useCase.execute({ house: "39/1", viewer: staff(["house:39/1:view"]) });

    expect(calls).toContain("39/1");
    expect(calls.some((entry) => entry.includes('"house":"39/1"'))).toBe(true);
  });

  it("квартира, которой нет в срезе, не получает ни голоса, ни веса", async () => {
    const { useCase } = build({ apartments: [103, 104, 777] });

    const result = await useCase.execute({ house: "39", viewer: staff(["house:39:view"]) });

    expect(result.cells.map((cell) => cell.number)).toEqual(["103", "104"]);
    expect(result.off_grid).toEqual([]);
  });

  it("площади и веса из Decimal-строк становятся числами", async () => {
    const { useCase } = build();

    const result = await useCase.execute({ house: "39", viewer: staff(["house:39:view"]) });

    expect(result.slice.pct_of_base).toBe(34.15);
    expect(result.cells[0].area).toBe(23.6);
    expect(result.cells[1].owners).toBe(2);
  });
});
