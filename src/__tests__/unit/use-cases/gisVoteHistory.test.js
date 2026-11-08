/* eslint-env jest */
/**
 * Сохранение среза и чтение его из истории.
 *
 * Главное, что здесь проверяется: отчёт, собранный по сохранённым строкам,
 * даёт ровно те же цифры, что разбор того же файла. Если арифметика среза
 * разъедется с арифметикой истории, админ увидит две разные «явки» за одну
 * дату — и правильно поймёт это только один раз.
 */

import { describe, expect, it } from "@jest/globals";
import { NotFoundError, ValidationError } from "../../../core/errors/AppError.js";
import { GisVoteAdminUseCases } from "../../../application/use-cases/gisVote/GisVoteAdminUseCases.js";
import { analyzeGisVotingWorkbook } from "../../../core/utils/gisVotingReport.js";
import { buildWorkbook } from "../utils/xlsxTestWorkbook.js";

const GIS_SHEET = "Статистика по голосованию";

const metaRows = (exportDate) => [
  { r: 1, cells: { A1: "СТАТИСТИКА ГОЛОСОВАНИЯ ПО АДРЕСУ:", F1: "630129, Новосибирская обл, г. Новосибирск, ул. Тайгинская, д. 39" } },
  { r: 4, cells: { A4: "1.1. Дата выгрузки", C4: exportDate } },
  { r: 6, cells: { A6: "1.3. ИНН", C6: 5410096778 } },
  { r: 13, cells: { A13: "№ помещения", J13: "Кадастровый номер помещения" } },
];

const ownerRow = (
  r,
  { room = "", area = null, share = 1, regn = `regn-${r}`, cadastre = "", bulletin = "", online = null }
) => ({
  r,
  cells: {
    [`A${r}`]: room,
    [`B${r}`]: area,
    [`C${r}`]: area,
    [`D${r}`]: "Собственность",
    [`E${r}`]: share,
    [`F${r}`]: regn,
    [`H${r}`]: bulletin,
    [`J${r}`]: cadastre,
    [`K${r}`]: online,
  },
});

const workbook = (exportDate, rows) =>
  buildWorkbook([{ name: GIS_SHEET, rows: [...metaRows(exportDate), ...rows] }]);

const OCTOBER = [
  ownerRow(14, { room: "103", area: 23.6, cadastre: "54:35:041122:1161", bulletin: "b-1161", online: 23.6 }),
  ownerRow(15, { room: "104", area: 45.5, cadastre: "54:35:041122:1162" }),
  ownerRow(16, { room: "Оф. 1", area: 91.8, cadastre: "54:35:041122:9100" }),
  // Общее имущество: без номера, в базу не входит.
  ownerRow(17, { area: 7659.9, cadastre: "54:35:041122:9200" }),
];

/** Репозиторий-подделка: хранит то, что в него положили, в форме строк БД. */
const buildReports = () => {
  const stored = [];

  return {
    stored,
    async saveSlice({ house, title, report, rooms, uploadedBy }) {
      const row = {
        id: BigInt(stored.length + 1),
        house,
        title,
        exported_at: new Date(`${report.meta.export_date}T00:00:00.000Z`),
        file_name: report.file_name,
        address: report.meta.address,
        house_fias: report.meta.house_fias,
        inn: report.meta.inn,
        management_company: report.meta.management_company,
        ownership_rows: report.fund.ownership_rows,
        rooms_total: report.fund.premises,
        area_total: String(report.fund.area_total),
        rooms_base: report.fund.base.premises,
        area_base: String(report.fund.base.area),
        area_common: String(report.fund.common.area),
        rooms_voted: report.participation.voted_premises,
        owners_voted: report.participation.voted_owners,
        weight_voted: String(report.participation.voted_weight),
        defects: report.defects,
        uploaded_by: uploadedBy === null ? null : BigInt(uploadedBy),
        created_at: new Date("2026-11-08T10:00:00.000Z"),
        rooms: rooms.map((premise, index) => ({
          id: BigInt(index + 1),
          report_id: BigInt(stored.length + 1),
          cadastre: premise.cadastre,
          room_label: premise.room,
          kind: premise.kind,
          in_base: premise.kind !== "common",
          owners: premise.owners,
          area: String(premise.area),
          weight: String(premise.weight),
          share_sum: String(premise.share_sum),
          voted: premise.voted,
          last_bulletin_date: premise.last_bulletin_date
            ? new Date(`${premise.last_bulletin_date}T00:00:00.000Z`)
            : null,
        })),
      };

      stored.push(row);

      return { report: row, replaced: false };
    },
    async getById(id) {
      return stored.find((row) => String(row.id) === String(id)) ?? null;
    },
    async list({ house = null, title = null } = {}) {
      return stored.filter(
        (row) => (!house || row.house === house) && (!title || row.title === title)
      );
    },
    async listWithRooms(options) {
      return this.list(options);
    },
    async delete(id) {
      const index = stored.findIndex((row) => String(row.id) === String(id));

      if (index === -1) return null;

      return stored.splice(index, 1)[0];
    },
    async titles() {
      return [...new Set(stored.map((row) => row.title))];
    },
  };
};

const buildCases = ({ houses = ["39", "39/1"] } = {}) => {
  const reports = buildReports();

  return {
    reports,
    cases: new GisVoteAdminUseCases({
      reports,
      houses: { findUniqueHouses: async () => houses },
    }),
  };
};

const bufferOf = (exportDate, rows = OCTOBER) => ({
  buffer: workbook(exportDate, rows),
  fileName: `${exportDate} выгрузка.xlsx`,
});

describe("сохранение среза в историю", () => {
  it("требует дом из справочника и название голосования", async () => {
    const { cases } = buildCases();

    await expect(
      cases.saveReport({ ...bufferOf("26.10.2026"), house: "17", title: "ОСС 2026" })
    ).rejects.toThrow(/Дома «17» в справочнике домов нет/);

    await expect(
      cases.saveReport({ ...bufferOf("26.10.2026"), house: "39", title: "   " })
    ).rejects.toThrow(/нужно название голосования/i);

    await expect(
      cases.saveReport({ buffer: null, house: "39", title: "ОСС 2026" })
    ).rejects.toThrow(/файл не пришёл/i);
  });

  it("сохраняет срез и отдаёт краткую строку истории", async () => {
    const { cases, reports } = buildCases();

    const saved = await cases.saveReport({
      ...bufferOf("26.10.2026"),
      house: "39",
      title: "ОСС 2026, кровля",
      uploadedBy: 7n,
    });

    expect(saved.replaced).toBe(false);
    expect(saved.slice).toMatchObject({
      house: "39",
      title: "ОСС 2026, кровля",
      exported_at: "2026-10-26",
      exported_at_label: "26.10.2026",
      rooms_total: 4,
      rooms_base: 3,
      rooms_voted: 1,
      area_base: 160.9,
      weight_voted: 23.6,
      pct_of_base: 14.67,
      uploaded_by: "7",
    });
    expect(reports.stored[0].rooms).toHaveLength(4);
    expect(reports.stored[0].id).toBe(1n);
  });

  it("отчитывает дату выгрузки из файла: без блока 1.1 срез некуда привязать", async () => {
    const { cases } = buildCases();

    await expect(
      cases.saveReport({
        buffer: buildWorkbook([{ name: GIS_SHEET, rows: [...metaRows(""), ...OCTOBER] }]),
        fileName: "без даты.xlsx",
        house: "39",
        title: "ОСС 2026",
      })
    ).rejects.toThrow(/нет даты выгрузки/i);
  });

  it("читает сохранённый срез теми же цифрами, что и разбор файла", async () => {
    const { cases } = buildCases();

    const saved = await cases.saveReport({
      ...bufferOf("26.10.2026"),
      house: "39",
      title: "ОСС 2026, кровля",
    });

    const fromDisk = await cases.getReport(saved.slice.id);
    const fromFile = analyzeGisVotingWorkbook(workbook("26.10.2026", OCTOBER), {
      fileName: "26.10.2026 выгрузка.xlsx",
    });

    expect(fromDisk.fund).toEqual(fromFile.fund);
    expect(fromDisk.participation).toEqual(fromFile.participation);
    expect(fromDisk.quorum).toEqual(fromFile.quorum);
    expect(fromDisk.by_kind).toEqual(fromFile.by_kind);
    expect(fromDisk.top_silent).toEqual(fromFile.top_silent);
    expect(fromDisk.defects).toEqual(fromFile.defects);
    expect(fromDisk.meta.export_date_label).toBe("26.10.2026");
    expect(fromDisk.house).toBe("39");
    expect(fromDisk.title).toBe("ОСС 2026, кровля");
  });

  it("несуществующий отчёт — 404, а не пустой ответ", async () => {
    const { cases } = buildCases();

    await expect(cases.getReport("42")).rejects.toThrow(NotFoundError);
    await expect(cases.removeReport("42")).rejects.toThrow(NotFoundError);
  });

  it("удаляет срез и список историю больше его не показывает", async () => {
    const { cases, reports } = buildCases();

    const saved = await cases.saveReport({
      ...bufferOf("26.10.2026"),
      house: "39",
      title: "ОСС 2026, кровля",
    });

    await cases.removeReport(saved.slice.id);

    expect(reports.stored).toHaveLength(0);
    expect(await cases.listSlices({ house: "39" })).toEqual([]);
  });
});

describe("история по дому и названию голосования", () => {
  it("строит срезы по датам и статусы помещений между ними", async () => {
    const { cases } = buildCases();

    // Октябрь: проголосовала только 103. Август: 103, 104 и 105. Два «ушедших»
    // помещения нужны ещё и тем, что их площадь складывается из строк БД —
    // конкатенация вместо суммы дала бы NaN прямо в отчёте.
    await cases.saveReport({
      ...bufferOf("26.10.2026", [
        ownerRow(14, { room: "103", area: 23.6, cadastre: "54:35:041122:1161", bulletin: "b-1161", online: 23.6 }),
        ownerRow(15, { room: "104", area: 45.5, cadastre: "54:35:041122:1162" }),
        ownerRow(16, { room: "105", area: 23.6, cadastre: "54:35:041122:1163" }),
      ]),
      house: "39",
      title: "ОСС 2026, кровля",
    });

    await cases.saveReport({
      ...bufferOf("24.08.2026", [
        ownerRow(14, { room: "103", area: 23.6, cadastre: "54:35:041122:1161", bulletin: "b-1161", online: 23.6 }),
        ownerRow(15, { room: "104", area: 45.5, cadastre: "54:35:041122:1162", bulletin: "b-1162", online: 45.5 }),
        ownerRow(16, { room: "105", area: 23.6, cadastre: "54:35:041122:1163", bulletin: "b-1163", online: 23.6 }),
      ]),
      house: "39",
      title: "ОСС 2026, кровля",
    });

    const history = await cases.history({ house: "39", title: "ОСС 2026, кровля" });

    expect(history.slices.map((row) => row.exported_at)).toEqual(["2026-08-24", "2026-10-26"]);
    expect(history.turnout.map((row) => row.voted_rooms)).toEqual([3, 1]);
    expect(history.slices.at(-1).delta).toMatchObject({ from_exported_at: "2026-08-24", voted_rooms: -2 });
    expect(history.changes).toHaveLength(1);
    expect(history.changes[0]).toMatchObject({
      previous_exported_at: "2026-08-24",
      current_exported_at: "2026-10-26",
      added: { rooms: 0, area: 0 },
      dropped: { rooms: 2, area: 69.1 },
      both: { rooms: 1, area: 23.6 },
    });

    const byRoom = Object.fromEntries(history.rooms.map((row) => [row.room, row]));

    expect(byRoom["103"].status).toBe("always");
    expect(byRoom["104"].status).toBe("stopped");
    expect(byRoom["105"].status).toBe("stopped");
    expect(history.participation_history).toMatchObject({ slices: 2, comparable: true, ever_voted: 3 });
    expect(history.known_houses).toEqual(["39", "39/1"]);
  });

  it("требует и дом, и название: история без пары не строится", async () => {
    const { cases } = buildCases();

    await expect(cases.history({ house: "39", title: "" })).rejects.toThrow(ValidationError);
  });

  it("неизвестное название голосования — пустая история, а не ошибка", async () => {
    const { cases } = buildCases();

    const history = await cases.history({ house: "39", title: "нет такого" });

    expect(history.slices).toEqual([]);
    expect(history.changes).toEqual([]);
    expect(history.participation_history).toBeNull();
  });

  it("список названий приходит из уже сохранённых срезов", async () => {
    const { cases } = buildCases();

    await cases.saveReport({
      ...bufferOf("26.10.2026"),
      house: "39",
      title: "ОСС 2026, кровля",
    });

    expect(await cases.titles({ house: "39" })).toEqual(["ОСС 2026, кровля"]);
    expect(await cases.titles({})).toEqual(["ОСС 2026, кровля"]);
  });
});
