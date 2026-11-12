/* eslint-env jest */
/**
 * Правила разбора выгрузки ГИС ЖКХ по голосованию.
 *
 * Фикстура смоделирована по настоящему файлу дома 39 (см. реестр
 * `docs/gis-voting-analysis-2026-11.md`): помещение с двумя совладельцами, два
 * безымянных нежилых с разной площадью, кладовка с офисом, квартира без
 * кадастра, квартира без площади и помещение с суммой долей 1,01. Каждый тест
 * держится на конкретной ловушке G1…G9, а не на «нравится ли цифра».
 */

import { describe, expect, it } from "@jest/globals";
import {
  analyzeGisVotingWorkbook,
  classifyPremise,
  normalizeGisDate,
} from "../../../core/utils/gisVotingReport.js";
import { buildWorkbook } from "./xlsxTestWorkbook.js";

const GIS_SHEET = "Статистика по голосованию";

const metaRows = [
  {
    r: 1,
    cells: {
      A1: "СТАТИСТИКА ГОЛОСОВАНИЯ ПО АДРЕСУ:",
      F1: "630129, Новосибирская обл, г. Новосибирск, ул. Тайгинская, д. 39",
    },
  },
  {
    r: 3,
    cells: { A3: "1. Общая информация", G3: "2. Итоговый расчёт на дату выгрузки", L3: "3. Расчет кворума на дату выгрузки" },
  },
  // Блоки 2.x и 3.x ГИС пишет нулями даже там, где проголосовавшие есть (G6).
  { r: 4, cells: { A4: "1.1. Дата выгрузки", C4: "26.10.2026", G4: "2.1. Итого площадь", J4: 0, M4: 0 } },
  { r: 5, cells: { A5: "1.2. Управляющая организация (УО)", C5: 'ООО "УК "Тайгинский Парк""' } },
  { r: 6, cells: { A6: "1.3. ИНН", C6: 5410096778 } },
  { r: 7, cells: { A7: "1.4. Код дома ФИАС", C7: "00ca51d7-2e7d-4ea7-9812-1dc7601c6e99" } },
  { r: 11, cells: { A11: "4. ПРОГОЛОСОВАВШИЕ ОНЛАЙН И ЗАОЧНО (ЧЕРЕЗ БЮЛЛЕТЕНЬ)" } },
  {
    r: 13,
    cells: {
      A13: "№ помещения",
      B13: "Площадь помещения по данным Росреестра",
      C13: "Итого площадь помещений по данным",
      D13: "Вид собственности",
      E13: "Доля в праве собственности",
      F13: "Номер собственности по данным Росреестра",
      G13: "Дата собственности по данным Росреестра",
      H13: "Номер собственности из бюллетеня",
      I13: "Дата собственности из бюллетеня",
      J13: "Кадастровый номер помещения",
      K13: "Проголосовали онлайн, голоса",
      L13: "Проголосовали через бюллетень (система)",
      M13: "Проголосовали через бюллетень (ручной ввод)",
      N13: "Комментарий",
    },
  },
];

/**
 * Строка собственника. Колонки: A №, B/C площадь, D вид, E доля, F номер
 * собственности, G её дата (serial), H/I бюллетень, J кадастр, K вес онлайн.
 */
const ownerRow = (
  r,
  {
    room = "",
    area = null,
    share = 1,
    ownershipKind = "Собственность",
    regn = `54/163/${r}`,
    regnDate = 45280,
    bulletin = "",
    bulletinDate = "",
    cadastre = "",
    online = null,
    bulletinSystem = null,
    bulletinManual = null,
  }
) => ({
  r,
  cells: {
    [`A${r}`]: room,
    [`B${r}`]: area,
    [`C${r}`]: area,
    [`D${r}`]: ownershipKind,
    [`E${r}`]: share,
    [`F${r}`]: regn,
    [`G${r}`]: regnDate,
    [`H${r}`]: bulletin,
    [`I${r}`]: bulletinDate,
    [`J${r}`]: cadastre,
    [`K${r}`]: online,
    [`L${r}`]: bulletinSystem,
    [`M${r}`]: bulletinManual,
  },
});

const REPORT_ROWS = [
  // 103 — проголосовавшая квартира: бюллетень и вес пришли вместе.
  ownerRow(14, {
    room: "103",
    area: 23.6,
    cadastre: "54:35:041122:1161",
    bulletin: "54:35:041122:1161-54/163/2024-1",
    bulletinDate: "2024-03-12",
    online: 23.6,
  }),
  // 116 — два совладельца: площадь только в первой строке (G2), и голос принёс
  // ВТОРОЙ совладелец, у своей строки площади нет. Его вес не сходится с
  // «площадь × доля» на 0,31 м², потому что ГИС хранит долю округлённо.
  ownerRow(15, {
    room: "116",
    area: 100,
    share: 0.67,
    ownershipKind: "Общая долевая собственность",
    cadastre: "54:35:041122:1175",
  }),
  ownerRow(16, {
    room: "116",
    share: 0.33,
    ownershipKind: "Общая долевая собственность",
    cadastre: "54:35:041122:1175",
    bulletin: "54:35:041122:1175-54/163/2025-2",
    bulletinDate: "2025-01-10",
    online: 33.31,
  }),
  // Кладовая: два совладельца с суммой долей 1,01 (G4) и без голоса.
  ownerRow(17, { room: "кладовая 12К", area: 3.5, share: 0.5, cadastre: "54:35:041122:9001" }),
  ownerRow(18, { room: "кладовая 12К", share: 0.51, cadastre: "54:35:041122:9001" }),
  ownerRow(19, { room: "Оф. 1", area: 91.8, cadastre: "54:35:041122:9100" }),
  // Квартира без кадастра: по пустому ключу её нельзя слить с другими (G1).
  ownerRow(20, { room: "460", area: 40 }),
  // Общее имущество: два помещения без номера, разные кадастры, 7000 м².
  ownerRow(21, { area: 5000, cadastre: "54:35:041122:9200" }),
  ownerRow(22, { area: 2000, cadastre: "54:35:041122:9201" }),
  // Квартира, у которой площади нет вовсе: её вес считать не из чего.
  ownerRow(23, { room: "501", cadastre: "54:35:041122:9501" }),
];

const analyze = (rows = [...metaRows, ...REPORT_ROWS]) =>
  analyzeGisVotingWorkbook(buildWorkbook([{ name: GIS_SHEET, rows }]), {
    fileName: "05.11.2026 выгрузка.xlsx",
  });

describe("разбор выгрузки ГИС ЖКХ", () => {
  it("берёт дату выгрузки из блока 1.1, а адрес и ИНН — из шапки", () => {
    expect(analyze().meta).toEqual({
      title: "СТАТИСТИКА ГОЛОСОВАНИЯ ПО АДРЕСУ:",
      export_date: "2026-10-26",
      export_date_label: "26.10.2026",
      address: "630129, Новосибирская обл, г. Новосибирск, ул. Тайгинская, д. 39",
      management_company: 'ООО "УК "Тайгинский Парк""',
      inn: "5410096778",
      house_fias: "00ca51d7-2e7d-4ea7-9812-1dc7601c6e99",
    });
  });

  it("исключает общее имущество из базы голосования (Q2)", () => {
    expect(analyze().fund).toEqual({
      ownership_rows: 10,
      premises: 8,
      area_total: 7258.9,
      base: { premises: 6, area: 258.9 },
      common: { premises: 2, area: 7000, pct_of_fund: 96.43 },
    });
  });

  it("считает участие по бюллетеню, а вес — из колонки K без пересчёта", () => {
    expect(analyze().participation).toEqual({
      voted_premises: 2,
      voted_owners: 2,
      voted_pct_of_premises: 33.33,
      voted_weight: 56.91,
      pct_of_base: 21.98,
      pct_of_fund: 0.78,
      silent: { premises: 4, area: 135.3, pct_of_base: 52.26 },
    });
  });

  it("переносит площадь вниз по помещению: голос второго совладельца не теряет вес", () => {
    const report = analyze();

    // 116 проголосовал вторым совладельцем — его 33,31 в сумме, несмотря на то
    // что в его строке площади нет.
    expect(report.participation.voted_weight).toBe(56.91);
    // Поэтому 116 нет в списке «кого агитировать», а молчат там по убыванию площади.
    expect(report.top_silent.map((row) => row.room)).toEqual([
      "Оф. 1",
      "460",
      "кладовая 12К",
      "501",
    ]);
  });

  it("считает разрыв до планки от базы и переводит его в квартиры", () => {
    expect(analyze().quorum).toEqual({
      percent: 50,
      needed_weight: 129.45,
      gap: 72.54,
      gap_pct: 28.02,
      reached: false,
      median_apartment_area: 40,
      apartments_to_close: 2,
    });
  });

  it("даёт разрез по типу помещения и отдельной строкой общее имущество", () => {
    const { by_kind, fund } = analyze();

    expect(by_kind.map((row) => [row.kind, row.in_base, row.premises, row.area])).toEqual([
      ["apartment", true, 4, 163.6],
      ["storage", true, 1, 3.5],
      ["office", true, 1, 91.8],
      ["common", false, 2, 7000],
    ]);

    const apartment = by_kind.find((row) => row.kind === "apartment");

    expect(apartment.voted_premises).toBe(2);
    expect(apartment.voted_weight).toBe(56.91);
    // Знаменатель — база целиком, а не площадь своего типа: доли типов должны
    // складываться в общую явку (замечание от 08.11).
    expect(apartment.voted_pct_of_base).toBe(21.98);
    expect(apartment.voted_pct_of_base).toBeCloseTo(
      (100 * apartment.voted_weight) / fund.base.area,
      2
    );
    expect(apartment.silent_area).toBe(40);
  });

  it("покрытие квартир считает по максимальному номеру, а список молчащих отдаёт целиком", () => {
    const { apartments, by_kind, top_silent, silent_truncated } = analyze();

    // Квартиры фикстуры: 103, 116, 460, 501. Нумерация доходит до 501, строк
    // четыре — 497 номеров в выгрузке нет, и это видно, а не «дом уменьшился».
    expect(apartments).toEqual({ present: 4, max_number: 501, missing: 497 });

    const apartment = by_kind.find((row) => row.kind === "apartment");

    expect(apartment.max_number).toBe(501);
    expect(apartment.missing_premises).toBe(497);
    // У не-квартирных типов нумерации нет.
    expect(by_kind.find((row) => row.kind === "office").max_number).toBeNull();
    expect(by_kind.find((row) => row.kind === "office").missing_premises).toBe(0);
    // Список молчащих полный: листает его фронт, сервер не обрезает.
    expect(top_silent).toHaveLength(4);
    expect(silent_truncated).toBe(false);
  });

  it("доли всех типов по весу складываются в явку базы", () => {
    const { by_kind, participation } = analyze();
    const fromKinds = by_kind
      .filter((row) => row.in_base)
      .reduce((total, row) => total + row.voted_pct_of_base, 0);

    expect(fromKinds).toBeCloseTo(participation.pct_of_base, 1);
  });

  it("показывает дефекты данных, а не правит их молча", () => {
    const { defects } = analyze();

    expect(defects.shares_not_one).toEqual([
      { room: "кладовая 12К", cadastre: "54:35:041122:9001", share_sum: 1.01 },
    ]);
    expect(defects.weight_mismatch).toEqual([
      { room: "116", expected: 33, in_file: 33.31, diff: 0.31 },
    ]);
    expect(defects.missing_area).toEqual([
      { room: "501", cadastre: "54:35:041122:9501" },
    ]);
    expect(defects.without_cadastre).toEqual([{ room: "460", owners: 1 }]);
    expect(defects.area_drift).toEqual([]);
    expect(defects.premise_voted_twice).toEqual([]);
    expect(defects.bulletin_without_weight).toBe(0);
    expect(defects.weight_without_bulletin).toBe(0);
    expect(defects.duplicate_ownership_numbers).toBe(0);
    expect(defects.common_property_excluded_from_base).toBe(true);
  });

  it("помечает помещение с двумя бюллетенями, но считает его один раз", () => {
    const rows = [
      ...metaRows,
      ownerRow(14, { room: "301", area: 50, cadastre: "54:35:041122:1301", bulletin: "b-1", online: 25 }),
      ownerRow(15, { room: "301", share: 0.5, cadastre: "54:35:041122:1301", bulletin: "b-2", online: 25 }),
    ];

    const report = analyzeGisVotingWorkbook(buildWorkbook([{ name: GIS_SHEET, rows }]));

    expect(report.participation.voted_premises).toBe(1);
    expect(report.participation.voted_owners).toBe(2);
    expect(report.participation.voted_weight).toBe(50);
    expect(report.defects.premise_voted_twice).toEqual([
      { room: "301", cadastre: "54:35:041122:1301", voted_owners: 2 },
    ]);
  });

  it("не теряет вес, если ГИС однажды заполнит колонки бюллетеней", () => {
    const rows = [
      ...metaRows,
      ownerRow(14, {
        room: "201",
        area: 50,
        cadastre: "54:35:041122:2201",
        bulletin: "2201-1",
        bulletinSystem: 30,
        bulletinManual: 20,
      }),
    ];

    const report = analyzeGisVotingWorkbook(buildWorkbook([{ name: GIS_SHEET, rows }]));

    expect(report.participation.voted_weight).toBe(50);
    expect(report.participation.voted_premises).toBe(1);
  });

  it("берёт рабочий лист по имени, даже если инструкция стоит первой", () => {
    const report = analyzeGisVotingWorkbook(
      buildWorkbook([
        { name: "Инструкция", rows: [{ r: 1, cells: { A1: "Как читать выгрузку" } }] },
        { name: GIS_SHEET, rows: [...metaRows, ...REPORT_ROWS] },
      ])
    );

    expect(report.sheet_name).toBe(GIS_SHEET);
    expect(report.fund.premises).toBe(8);
  });

  it("не принимает файл без реестра голосований и без строк собственников", () => {
    expect(() =>
      analyze([{ r: 1, cells: { A1: "1. Общая информация" } }])
    ).toThrow(/нет реестра голосований/);
    expect(() => analyze(metaRows)).toThrow(/ни одной строки собственника/);
  });
});

describe("мелочи разбора", () => {
  it("нормализует serial-дату Росреестра и ISO-дату бюллетеня", () => {
    expect(normalizeGisDate(45363)).toBe("2024-03-12");
    expect(normalizeGisDate("45280")).toBe("2023-12-20");
    expect(normalizeGisDate("2024-03-12")).toBe("2024-03-12");
    expect(normalizeGisDate("26.10.2026")).toBe("2026-10-26");
    expect(normalizeGisDate("")).toBeNull();
    expect(normalizeGisDate("нет данных")).toBeNull();
  });

  it("типом помещения решает формат номера, а не Number()", () => {
    expect(classifyPremise("103")).toBe("apartment");
    expect(classifyPremise("1")).toBe("apartment");
    expect(classifyPremise("кладовая 12К")).toBe("storage");
    expect(classifyPremise("Оф. 1")).toBe("office");
    expect(classifyPremise("")).toBe("common");
    expect(classifyPremise("Паркинг 55")).toBe("other_non_residential");
  });
});
