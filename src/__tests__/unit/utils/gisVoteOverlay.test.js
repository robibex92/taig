/* eslint-env jest */
/**
 * Наложение среза ГИС ЖКХ на сетку квартир.
 *
 * Здесь живёт единственное место, где номер помещения из выгрузки встречается с
 * `houses.number`. Проверяем то, на чём нельзя экономить: нечисловые метки не
 * должны молча исчезать, а «проголосовала квартира» не должно читаться как
 * «проголосовала доля» — у совладельцев вес разный.
 */

import { describe, expect, it } from "@jest/globals";
import { buildGisVoteOverlay, titlesVotedByLabel } from "../../../core/utils/gisVoteOverlay.js";

const report = {
  house: "39",
  title: "ОСС 2026, кровля",
  exported_at: new Date("2026-10-26T00:00:00.000Z"),
  rooms_total: 6,
  rooms_base: 5,
  rooms_voted: 2,
  area_base: "258.90",
  weight_voted: "90.91",
};

const room = (overrides) => ({
  id: 1n,
  report_id: 1n,
  cadastre: "54:35:041122:1161",
  room_label: "103",
  kind: "apartment",
  in_base: true,
  owners: 1,
  area: "23.60",
  weight: "23.60",
  share_sum: "1.0000",
  voted: true,
  last_bulletin_date: new Date("2024-03-12T00:00:00.000Z"),
  ...overrides,
});

const ROOMS = [
  room({}),
  room({ cadastre: "54:35:041122:1162", room_label: "104", area: "45.50", weight: "0.00", voted: false }),
  // Номер с пробелом в выгрузке — то же помещение, что `105` в базе.
  room({ cadastre: "54:35:041122:1165", room_label: " 105 ", area: "40.00", weight: "40.00" }),
  room({
    cadastre: "54:35:041122:9100",
    room_label: "Оф. 1",
    kind: "office",
    area: "91.80",
    weight: "0.00",
    voted: false,
  }),
  room({
    cadastre: "54:35:041122:9001",
    room_label: "кладовая 12К",
    kind: "storage",
    area: "3.50",
    weight: "0.00",
    voted: false,
  }),
  // Общее имущество: метки нет вовсе, в ячейку попасть не может.
  room({
    cadastre: "54:35:041122:9200",
    room_label: null,
    kind: "common",
    in_base: false,
    area: "5000.00",
    weight: "0.00",
    voted: false,
  }),
];

const APARTMENTS = [
  { id: 1n, number: 103 },
  { id: 2n, number: 104 },
  { id: 3n, number: 105 },
  { id: 4n, number: 462 },
];

// Участие: 103 — в одном голосовании, 105 — в двух (строки идут от свежего среза
// к позднему, как их отдаёт репозиторий), 104 — ни в одном.
const votedTitles = () =>
  titlesVotedByLabel([
    { room_label: "103", report: { title: "ОСС 2026, кровля" } },
    { room_label: "105", report: { title: "ОСС 2026, кровля" } },
    { room_label: "105", report: { title: "ОСС 2025, подъезд" } },
  ]);

const overlay = () =>
  buildGisVoteOverlay({ report, rooms: ROOMS, apartments: APARTMENTS, votedTitles: votedTitles() });

describe("наложение среза на сетку квартир", () => {
  it("подписывает срез, чтобы подпись «по срезу …» читалась честно", () => {
    expect(overlay().slice).toEqual({
      house: "39",
      title: "ОСС 2026, кровля",
      exported_at: "2026-10-26",
      exported_at_label: "26.10.2026",
      rooms_total: 6,
      rooms_base: 5,
      rooms_voted: 2,
      pct_of_base: 35.11,
    });
  });

  it("сопоставляет по номеру помещения и несёт вес доли, а не галочку", () => {
    const { cells } = overlay();

    expect(cells).toEqual([
      {
        id: "1",
        number: "103",
        voted: true,
        voted_titles: ["ОСС 2026, кровля"],
        share_pct: 9.12,
        weight: 23.6,
        area: 23.6,
        owners: 1,
        cadastre: "54:35:041122:1161",
      },
      {
        id: "2",
        number: "104",
        voted: false,
        voted_titles: [],
        share_pct: 17.57,
        weight: 0,
        area: 45.5,
        owners: 1,
        cadastre: "54:35:041122:1162",
      },
      // `105` совпал несмотря на пробелы в метке выгрузки.
      {
        id: "3",
        number: "105",
        voted: true,
        voted_titles: ["ОСС 2026, кровля", "ОСС 2025, подъезд"],
        share_pct: 15.45,
        weight: 40,
        area: 40,
        owners: 1,
        cadastre: "54:35:041122:1165",
      },
    ]);
    // Доля считается от площади помещения, а не от отданного веса: у молчащей
    // квартиры вес нулевой, но свою долю голоса она всё равно приносит, и
    // interface не должен показывать ей «0 %».
    expect(cells.find((cell) => cell.number === "104").share_pct).toBeGreaterThan(0);
    // У квартиры 462 помещения в срезе нет — ячейка остаётся без признака, а не
    // получает «не голосовала».
    expect(cells.some((cell) => cell.number === "462")).toBe(false);
  });

  it("голосовавшая в прошлом ОСС не теряет отметку, когда в свежем срезе молчит", () => {
    // 104 в свежем срезе молчит (`voted: false`), но в прежнем срезе дома
    // бюллетень оставила. Панель ей участие перечисляет — отметка обязана тоже.
    const titles = titlesVotedByLabel([
      {
        room_label: "104",
        report: { title: "ОСС 2025, подъезд", exported_at: new Date("2026-08-24T00:00:00.000Z") },
      },
    ]);
    const { cells } = buildGisVoteOverlay({
      report,
      rooms: ROOMS,
      apartments: APARTMENTS,
      votedTitles: titles,
    });
    const cell = cells.find((row) => row.number === "104");

    expect(cell.voted).toBe(true);
    expect(cell.voted_titles).toEqual(["ОСС 2025, подъезд"]);
    // Доля и вес остаются из свежего среза: история участия их не переписывает.
    expect(cell).toMatchObject({ weight: 0, area: 45.5, share_pct: 17.57 });
  });

  it("отметка стоит ровно там, где панель перечисляет участия", () => {
    for (const cell of overlay().cells) {
      expect(cell.voted).toBe(cell.voted_titles.length > 0);
    }
  });

  it("помещений вне сетки не теряет: офис и кладовая уходят отдельным списком", () => {
    const { off_grid } = overlay();

    expect(off_grid.map((row) => row.room)).toEqual(["Оф. 1", "кладовая 12К"]);
    expect(off_grid[0]).toMatchObject({ kind: "office", area: 91.8, voted: false });
  });

  it("два помещения с одним номером помечает как спорное, а не выбирает молча первое", () => {
    const result = buildGisVoteOverlay({
      report,
      rooms: [
        room({ cadastre: "a", room_label: "103", area: "23.60", weight: "23.60" }),
        room({ cadastre: "b", room_label: "103", area: "30.00", weight: "0.00", voted: false, owners: 2 }),
      ],
      apartments: [{ id: 1n, number: 103 }],
    });

    expect(result.ambiguous).toEqual([{ room: "103", area: 53.6, owners: 3 }]);
    // вес и площадь складываются по обоим помещениям, голос — если есть у любого
    expect(result.cells[0]).toMatchObject({ voted: true, weight: 23.6, area: 53.6, owners: 3 });
  });

  it("перечисляет участия от свежего среза к позднему и не дробит одно голосование", () => {
    const titles = titlesVotedByLabel([
      // Строки пришли вразнобой и с повторами — как их отдаёт база.
      { room_label: "103", report: { title: "ОСС 2025, подъезд", exported_at: new Date("2025-12-20T00:00:00.000Z") } },
      { room_label: "103", report: { title: "ОСС 2026, кровля", exported_at: new Date("2026-10-26T00:00:00.000Z") } },
      { room_label: "103", report: { title: "ОСС 2026, кровля", exported_at: new Date("2026-08-24T00:00:00.000Z") } },
    ]);

    expect(titles.get("103")).toEqual(["ОСС 2026, кровля", "ОСС 2025, подъезд"]);
  });

  it("пустой список квартир не ломает наложение", () => {
    const result = buildGisVoteOverlay({ report, rooms: ROOMS, apartments: [] });

    expect(result.cells).toEqual([]);
    // Безымянное общее имущество в `off_grid` не попадает: у него нет метки,
    // по которой вообще можно что-то сопоставить.
    expect(result.off_grid).toHaveLength(5);
  });
});
