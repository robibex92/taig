/* eslint-env jest */
/**
 * Арифметика истории голосований: порядок срезов, статусы помещений и дельты.
 *
 * Проверяем то, на чём строится ответ «квартира постоянно голосует / раньше не
 * голосовала»: порядок — по дате выгрузки, статус — по всем срезам голосования,
 * а не по одному последнему.
 */

import {
  buildGisVotingHistory,
  compareGisSlices,
  premiseFromRoomRow,
} from "../../../core/utils/gisVotingHistory.js";

const room = (overrides) => ({
  id: 1,
  report_id: 1n,
  cadastre: "54:35:041122:100",
  room_label: "100",
  kind: "apartment",
  in_base: true,
  owners: 1,
  area: "40.00",
  weight: "0.00",
  share_sum: "1.0000",
  voted: false,
  last_bulletin_date: null,
  ...overrides,
});

// id среза — число из его даты, чтобы порядок в тесте читался по датам.
const slice = (exportedAt, rooms) => ({
  id: BigInt(exportedAt.replace(/-/g, "")),
  house: "39",
  title: "ОСС 2026",
  exported_at: new Date(`${exportedAt}T00:00:00.000Z`),
  file_name: `${exportedAt}.xlsx`,
  address: "ул. Тайгинская, д. 39",
  uploaded_by: 7n,
  created_at: new Date(`${exportedAt}T09:00:00.000Z`),
  defects: { shares_not_one: [] },
  premises: rooms,
});

describe("строка помещений → помещение среза", () => {
  it("превращает Decimal и дату в числа и ISO-строки", () => {
    const premise = premiseFromRoomRow(
      room({ weight: "23.60", voted: true, last_bulletin_date: new Date("2024-03-12T00:00:00.000Z") })
    );

    expect(premise).toEqual({
      room: "100",
      cadastre: "54:35:041122:100",
      kind: "apartment",
      label: "Квартира",
      area: 40,
      weight: 23.6,
      share_sum: 1,
      owners: 1,
      voted_owners: 1,
      voted: true,
      last_bulletin_date: "2024-03-12",
    });
  });

  it("не теряет помещение без кадастрового номера", () => {
    const premise = premiseFromRoomRow(room({ cadastre: null, room_label: "460" }));

    expect(premise.cadastre).toBeNull();
    expect(premise.room).toBe("460");
  });
});

describe("история одного голосования", () => {
  // Три среза: 100 голосует всегда, 200 — только в среднем, 300 — впервые в
  // последнем, 400 — молчит вообще, 500 — голосовало и бросило.
  const slices = [
    slice("2026-10-26", [
      room({ cadastre: "c100", room_label: "100", weight: "40.00", voted: true }),
      room({ cadastre: "c300", room_label: "300", weight: "40.00", voted: true }),
      room({ cadastre: "c200", room_label: "200" }),
      room({ cadastre: "c400", room_label: "400" }),
      room({ cadastre: "c500", room_label: "500" }),
    ]),
    slice("2026-07-24", [
      room({ cadastre: "c100", room_label: "100", weight: "40.00", voted: true }),
      room({ cadastre: "c200", room_label: "200", weight: "40.00", voted: true }),
      room({ cadastre: "c500", room_label: "500", weight: "40.00", voted: true }),
      room({ cadastre: "c400", room_label: "400" }),
      room({ cadastre: "c300", room_label: "300" }),
    ]),
    slice("2026-06-01", [
      room({ cadastre: "c100", room_label: "100", weight: "40.00", voted: true }),
      room({ cadastre: "c500", room_label: "500", weight: "40.00", voted: true }),
      room({ cadastre: "c200", room_label: "200" }),
      room({ cadastre: "c300", room_label: "300" }),
      room({ cadastre: "c400", room_label: "400" }),
    ]),
  ];

  it("стабильно сортирует срезы по дате выгрузки, а не по порядку входа", () => {
    const history = buildGisVotingHistory(slices);

    expect(history.slices.map((row) => row.exported_at)).toEqual([
      "2026-06-01",
      "2026-07-24",
      "2026-10-26",
    ]);
    expect(history.slices[0].exported_at_label).toBe("01.06.2026");
    expect(history.slices[0].delta).toBeNull();
    expect(history.turnout.map((row) => row.voted_rooms)).toEqual([2, 3, 2]);
    expect(history.turnout.map((row) => row.delta_voted_rooms)).toEqual([null, 1, -1]);
  });

  it("даёт статус помещения по всем срезам, а не по последнему", () => {
    const { rooms, participation_history } = buildGisVotingHistory(slices);
    const byRoom = Object.fromEntries(rooms.map((row) => [row.room, row]));

    expect(byRoom["100"].status).toBe("always");
    expect(byRoom["200"].status).toBe("stopped");
    expect(byRoom["300"].status).toBe("first_time");
    expect(byRoom["400"].status).toBe("never");
    expect(byRoom["500"].status).toBe("stopped");
    expect(byRoom["200"].voted_slices).toBe(1);
    expect(byRoom["100"].last_voted_at).toBe("2026-10-26");

    expect(participation_history).toMatchObject({
      slices: 3,
      comparable: true,
      rooms_total: 5,
      ever_voted: 4,
      ever_voted_pct: 80,
      always_voted: 1,
      first_time: 1,
      stopped: 2,
      never: 1,
    });
  });

  it("не врет про «постоянно», когда срез один", () => {
    const history = buildGisVotingHistory([slices[2]]);
    const byRoom = Object.fromEntries(history.rooms.map((row) => [row.room, row]));

    expect(byRoom["100"].status).toBe("single");
    expect(byRoom["200"].status).toBe("never");
    expect(history.participation_history.comparable).toBe(false);
    expect(history.slices[0].delta).toBeNull();
  });

  it("не путает голос весов с числом помещений", () => {
    const { slices: rows } = buildGisVotingHistory(slices);
    const last = rows.at(-1).summary;

    expect(last.participation.voted_premises).toBe(2);
    expect(last.participation.voted_weight).toBe(80);
    expect(last.fund.base.area).toBe(200);
    expect(last.participation.pct_of_base).toBe(40);
    expect(last.quorum.reached).toBe(false);
  });

  it("общее имущество остаётся вне базы и в истории", () => {
    const history = buildGisVotingHistory([
      slice("2026-10-26", [
        room({ cadastre: "c100", room_label: "100", weight: "40.00", voted: true }),
        room({ cadastre: "c900", room_label: "", kind: "common", area: "7000.00" }),
      ]),
    ]);

    expect(history.slices[0].summary.fund.base).toEqual({ premises: 1, area: 40 });
    expect(history.rooms.map((row) => row.room)).toEqual(["100"]);
  });
});

describe("сравнение двух срезов", () => {
  it("разводит пришедших, ушедших и проголосовавших в обоих", () => {
    const previous = slice("2026-07-24", [
      room({ cadastre: "c1", room_label: "1", weight: "40.00", voted: true }),
      room({ cadastre: "c2", room_label: "2", weight: "40.00", voted: true }),
      room({ cadastre: "c3", room_label: "3" }),
    ]);
    const current = slice("2026-10-26", [
      room({ cadastre: "c1", room_label: "1", weight: "40.00", voted: true }),
      room({ cadastre: "c3", room_label: "3", weight: "40.00", voted: true }),
      room({ cadastre: "c4", room_label: "4", area: "80.00" }),
    ]);

    expect(compareGisSlices(previous, current)).toEqual({
      previous_exported_at: "2026-07-24",
      current_exported_at: "2026-10-26",
      added: { rooms: 1, area: 40 },
      dropped: { rooms: 1, area: 40 },
      both: { rooms: 1, area: 40 },
    });
  });
});
