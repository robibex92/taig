/**
 * Правила разбора выгрузки ГИС ЖКХ «Статистика по голосованию».
 *
 * Всё, что здесь написано, проверено на двух реальных файлах дома 39 и взято из
 * реестра `docs/gis-voting-analysis-2026-11.md` (ловушки G1…G9). Четыре правила
 * без них цифры врут:
 *
 * 1. помещение — это кадастровый номер (колонка J), а не «№ помещения»: у двух
 *    крупных нежилых колонка A пустая, и группировка по ней теряет 24,6 % фонда;
 * 2. площадь (B) стоит только в первой строке помещения — её надо переносить вниз
 *    по группе, иначе вес доли совладельца превращается в ноль;
 * 3. вес голоса берётся из K как данность: ГИС хранит долю округлённо, и
 *    пересчёт «площадь × доля» расходится с файлом до 0,34 м²;
 * 4. участие = наличие номера из бюллетеня (H). Колонки L/M/N пустые всегда,
 *    поэтому «онлайн / заочно» по этому файлу различить нельзя и в отчёте этого
 *    нет.
 *
 * База голосования по решению от 07.11 исключает общее имущество (помещения без
 * номера) — на экране знаменатель подписан явно, чтобы 8,83 % не выглядели 6,66 %.
 */

import { ValidationError } from "../errors/AppError.js";
import { readWorkbook } from "./xlsxWorkbook.js";

/** Планка кворума, от которой считаем разрыв (ст. 45 ЖК — 50 % голосов). */
export const GIS_QUORUM_PERCENT = 50;

/** Сколько «молчунов» отдаём наружу, и так ли список обрезан. */
export const GIS_SILENT_LIST_LIMIT = 100;

const COLUMN = {
  room: 1,
  area_rosp: 2,
  area_total: 3,
  ownership_kind: 4,
  share: 5,
  regn_num: 6,
  regn_date: 7,
  bulletin_num: 8,
  bulletin_date: 9,
  cadastre: 10,
  weight_online: 11,
  weight_bulletin_system: 12,
  weight_bulletin_manual: 13,
};

export const GIS_PREMISE_KINDS = {
  apartment: "Квартира",
  storage: "Кладовое помещение",
  office: "Офис",
  other_non_residential: "Прочее нежилое",
  common: "Общее имущество (без номера)",
};

const SHEET_HINT = /статистика по голосованию/i;
const HEADER_RE = /№\s*помещения/i;
const TITLE_RE = /статистика голосования/i;

/** Допуск, за которым «площадь × доля» перестаёт походить на вес из колонки K. */
const WEIGHT_TOLERANCE = 0.05;
/** Сумма долей помещения обязана быть 1; всё, что дальше этого, — дефект данных. */
const SHARE_TOLERANCE = 0.01;

const round = (value, digits = 2) => {
  const factor = 10 ** digits;

  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;

  const parsed = Number.parseFloat(String(value).replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
};

/** ISO `YYYY-MM-DD` из serial-числа Excel (эпоха 1899-12-30 — с её прыжком 1900). */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86400000;

/**
 * Колонки G и I — разные форматы: serial (`45363`) и ISO-строка (`2024-03-12`).
 * Без нормализации дата собственности уезжает в 1905 год.
 */
export const normalizeGisDate = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  const serial = toNumber(text);
  if (serial === null || serial <= 0 || serial > 60000) return null;

  return new Date(EXCEL_EPOCH_UTC + Math.round(serial) * DAY_MS).toISOString().slice(0, 10);
};

const russianDate = (isoDate) => {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split("-");

  return `${day}.${month}.${year}`;
};

/** Тип помещения по формату номера: не числом и не уникальным текстом (G8). */
export const classifyPremise = (roomLabel) => {
  const room = String(roomLabel ?? "").trim();

  if (!room) return "common";
  if (/^\d+$/.test(room)) return "apartment";
  if (/^оф/i.test(room)) return "office";
  if (/клад/i.test(room)) return "storage";

  return "other_non_residential";
};

/**
 * Рабочий лист: имя → строки, отсортированные по номеру. Порядок тегов в XML
 * номеру строки не обещан, а поиск заголовка и метаданных идёт сверху вниз.
 */
const pickSheet = (workbook) => {
  const name =
    workbook.sheetNames.find((sheet) => SHEET_HINT.test(sheet)) ?? workbook.sheetNames[0];

  return {
    name,
    rows: [...workbook.readSheet(name).entries()].sort(([a], [b]) => a - b),
  };
};

const cell = (row, column) => row.get(column) ?? "";

/**
 * Заголовок листа с адресом и блоки 1.x («1.1. Дата выгрузки», УО, ИНН, ФИАС).
 * Ищем по метке, а не по номеру строки: ГИС сдвигает служебные строки, когда
 * меняет шаблон выгрузки, а номер строки при этом ничего не значит.
 */
const readMetaBlock = (rows, headerRowNumber) => {
  const blocks = {};
  let address = null;
  let title = null;

  for (const [rowNumber, row] of rows) {
    if (rowNumber >= headerRowNumber) break;

    const label = cell(row, 1);
    const valueCell = [...row.entries()].find(([column, text]) => column > 1 && text !== "");
    if (!valueCell) continue;

    if (TITLE_RE.test(label)) {
      title = label;
      address = valueCell[1];
      continue;
    }

    const key = /^1\.(\d+)/.exec(label)?.[1];
    if (key) blocks[key] = valueCell[1];
  }

  return { blocks, address, title };
};

/** Одна строка собственника → доля. Строки без кадастра помещением считать нельзя. */
const readOwnershipRows = (rows, headerRowNumber) => {
  const collected = [];

  for (const [rowNumber, row] of rows) {
    if (rowNumber <= headerRowNumber) continue;

    const room = cell(row, COLUMN.room);
    const cadastre = cell(row, COLUMN.cadastre);
    const regnNum = cell(row, COLUMN.regn_num);

    if (!room && !cadastre && !regnNum) continue;

    collected.push({
      row_number: rowNumber,
      room,
      cadastre,
      regn_num: regnNum,
      area_rosp: toNumber(cell(row, COLUMN.area_rosp)),
      area_total: toNumber(cell(row, COLUMN.area_total)),
      share: toNumber(cell(row, COLUMN.share)),
      bulletin_num: cell(row, COLUMN.bulletin_num),
      bulletin_date: normalizeGisDate(cell(row, COLUMN.bulletin_date)),
      regn_date: normalizeGisDate(cell(row, COLUMN.regn_date)),
      weight_online: toNumber(cell(row, COLUMN.weight_online)),
      // В этих выгрузках L/M пустые всегда, но если ГИС начнёт их заполнять,
      // вес не должен потеряться: участие всё равно определяем по бюллетеню.
      weight_bulletin:
        (toNumber(cell(row, COLUMN.weight_bulletin_system)) ?? 0) +
        (toNumber(cell(row, COLUMN.weight_bulletin_manual)) ?? 0),
    });
  }

  return collected;
};

/**
 * Группировка по кадастру (G1) с переносом площади вниз по группе (G2).
 * Строки без кадастра остаются отдельными помещениями и попадут в дефекты.
 */
const groupPremises = (ownershipRows) => {
  const groups = new Map();

  for (const row of ownershipRows) {
    // Кадастра нет — ключ по номеру собственности, иначе все безкадастровые
    // строки слиплись бы в одно помещение.
    const key = row.cadastre || `regn:${row.regn_num}`;
    const group = groups.get(key);

    if (group) {
      group.owners.push(row);
      continue;
    }

    groups.set(key, {
      cadastre: row.cadastre || null,
      room: row.room,
      kind: classifyPremise(row.room),
      owners: [row],
    });
  }

  return [...groups.values()];
};

const areaOf = (premise) => {
  const first = premise.owners.find((owner) => owner.area_rosp !== null);

  return first ? round(first.area_rosp) : 0;
};

const weightOf = (premise) =>
  round(
    premise.owners.reduce(
      (sum, owner) => sum + (owner.weight_online ?? 0) + owner.weight_bulletin,
      0
    )
  );

const shareSumOf = (premise) =>
  round(premise.owners.reduce((sum, owner) => sum + (owner.share ?? 0), 0));

const premiseView = (premise) => {
  const area = areaOf(premise);
  const weight = weightOf(premise);
  const votedOwners = premise.owners.filter((owner) => owner.bulletin_num !== "");

  return {
    room: premise.room,
    cadastre: premise.cadastre,
    kind: premise.kind,
    label: GIS_PREMISE_KINDS[premise.kind],
    area,
    weight,
    share_sum: shareSumOf(premise),
    owners: premise.owners.length,
    voted_owners: votedOwners.length,
    voted: weight > 0 || votedOwners.length > 0,
    last_bulletin_date: votedOwners.map((owner) => owner.bulletin_date).filter(Boolean).sort().at(-1) ?? null,
  };
};

const sumArea = (premises) => round(premises.reduce((total, premise) => total + premise.area, 0));

const percentOf = (value, base) => (base > 0 ? round((100 * value) / base) : null);

const medianApartmentArea = (premises) => {
  const areas = premises
    .filter((premise) => premise.kind === "apartment" && premise.area > 0)
    .map((premise) => premise.area)
    .sort((a, b) => a - b);

  if (areas.length === 0) return null;
  const middle = Math.floor(areas.length / 2);

  return areas.length % 2 ? areas[middle] : round((areas[middle - 1] + areas[middle]) / 2);
};

/**
 * V6: разбивка по типам помещений. Проценты — от базы, а не «внутри своего типа»:
 * доли типов должны складываться в общую явку, иначе «9,14 % площади типа» читается
 * как вклад типа в кворум, которым он не является.
 */
const byKind = (premises, baseArea) =>
  Object.entries(GIS_PREMISE_KINDS)
    .map(([kind, label]) => {
      const group = premises.filter((premise) => premise.kind === kind);

      if (group.length === 0) return null;

      const area = sumArea(group);
      const voted = group.filter((premise) => premise.voted);
      const votedWeight = round(voted.reduce((total, premise) => total + premise.weight, 0));

      return {
        kind,
        label,
        // Общее имущество в знаменатель решения от 07.11 не входит.
        in_base: kind !== "common",
        premises: group.length,
        area,
        voted_premises: voted.length,
        voted_weight: votedWeight,
        voted_pct_of_base: percentOf(votedWeight, baseArea),
        silent_premises: group.length - voted.length,
        silent_area: round(area - voted.reduce((total, premise) => total + premise.area, 0)),
      };
    })
    .filter(Boolean);

/** В7: всё, чем файл сам себя подрывает. Молча это не нормализуем. */
const collectDefects = (groups, premises) => {
  const sharesNotOne = premises
    .filter((premise) => Math.abs(premise.share_sum - 1) > SHARE_TOLERANCE)
    .map((premise) => ({
      room: premise.room,
      cadastre: premise.cadastre,
      share_sum: premise.share_sum,
    }));

  // Контроль правила веса: K сверяем с «площадь помещения × доля этого
  // совладельца» — площадь берём перенесённую по группе, потому что в строке
  // продолжения её нет (G2), а share у совладельцев разные.
  const weightMismatch = [];
  for (const group of groups) {
    const area = areaOf(group);

    for (const owner of group.owners) {
      if (owner.weight_online === null) continue;

      const expected = round(area * (owner.share ?? 1));

      if (Math.abs(expected - owner.weight_online) > WEIGHT_TOLERANCE) {
        weightMismatch.push({
          room: group.room,
          expected,
          in_file: owner.weight_online,
          diff: round(Math.abs(expected - owner.weight_online)),
        });
      }
    }
  }

  const areaDrift = groups
    .flatMap((group) => group.owners)
    .filter(
      (row) =>
        row.area_rosp !== null &&
        row.area_total !== null &&
        Math.abs(row.area_rosp - row.area_total) > WEIGHT_TOLERANCE
    )
    .map((row) => ({ room: row.room, area_rosp: row.area_rosp, area_total: row.area_total }));

  const ownershipRows = groups.flatMap((group) => group.owners);
  const bulletinWithoutWeight = ownershipRows.filter(
    (row) => row.bulletin_num !== "" && (row.weight_online ?? 0) <= 0
  ).length;
  const weightWithoutBulletin = ownershipRows.filter(
    (row) => (row.weight_online ?? 0) > 0 && row.bulletin_num === ""
  ).length;

  const regnNumbers = ownershipRows.map((row) => row.regn_num).filter(Boolean);

  return {
    // Σдолей ≠ 1: дефект Росреестра, из-за него «доля проголосовавших» не сходится
    // с суммой весов, и причину надо показывать, а не править молча.
    shares_not_one: sharesNotOne,
    // G2: площадь есть не у каждой группы — без forward-fill вес стал бы нулём.
    missing_area: premises.filter((premise) => premise.area === 0).map((premise) => ({
      room: premise.room,
      cadastre: premise.cadastre,
    })),
    weight_mismatch: weightMismatch,
    area_drift: areaDrift,
    without_cadastre: premises.filter((premise) => !premise.cadastre).map((premise) => ({
      room: premise.room,
      owners: premise.owners,
    })),
    bulletin_without_weight: bulletinWithoutWeight,
    weight_without_bulletin: weightWithoutBulletin,
    duplicate_ownership_numbers: regnNumbers.length - new Set(regnNumbers).size,
    // Два совладельца одного помещения принесли по бюллетеню: вес суммируется,
    // но «помещение проголосовало» всё равно один раз.
    premise_voted_twice: premises
      .filter((premise) => premise.voted_owners > 1)
      .map((premise) => ({
        room: premise.room,
        cadastre: premise.cadastre,
        voted_owners: premise.voted_owners,
      })),
    common_property_excluded_from_base: premises.some((premise) => premise.kind === "common"),
    // ГИС пишет пустые итоги в блоках 2.x и 3.x, сверять «как в ГИС» не с чем.
    gis_summary_blocks_empty: true,
  };
};

/**
 * Арифметика среза по списку помещений.
 *
 * Одна и та же функция считает и только что разобранный файл, и срез, прочитанный
 * из истории: иначе цифры «до сохранения» и «после» разъехались бы, а сверять их
 * руками никто бы не стал.
 */
export const summarizeGisPremises = (premises) => {
  const base = premises.filter((premise) => premise.kind !== "common");
  const common = premises.filter((premise) => premise.kind === "common");

  const fundArea = sumArea(premises);
  const baseArea = sumArea(base);
  const commonArea = sumArea(common);

  const voted = base.filter((premise) => premise.voted);
  const votedWeight = round(voted.reduce((total, premise) => total + premise.weight, 0));
  const silent = base.filter((premise) => !premise.voted);
  const silentArea = round(silent.reduce((total, premise) => total + premise.area, 0));

  const median = medianApartmentArea(premises);
  const needed = round((baseArea * GIS_QUORUM_PERCENT) / 100);
  const gap = round(needed - votedWeight);

  // V6: кого агитировать в первую очередь — молчащие по убыванию веса.
  const silentSorted = [...silent].sort((a, b) => b.area - a.area);

  return {
    fund: {
      premises: premises.length,
      area_total: fundArea,
      base: { premises: base.length, area: baseArea },
      common: { premises: common.length, area: commonArea, pct_of_fund: percentOf(commonArea, fundArea) },
    },
    participation: {
      voted_premises: voted.length,
      voted_owners: voted.reduce((total, premise) => total + premise.voted_owners, 0),
      voted_pct_of_premises: percentOf(voted.length, base.length),
      voted_weight: votedWeight,
      pct_of_base: percentOf(votedWeight, baseArea),
      pct_of_fund: percentOf(votedWeight, fundArea),
      silent: { premises: silent.length, area: silentArea, pct_of_base: percentOf(silentArea, baseArea) },
    },
    quorum: {
      percent: GIS_QUORUM_PERCENT,
      needed_weight: needed,
      gap,
      gap_pct: percentOf(gap, baseArea),
      reached: votedWeight >= needed,
      median_apartment_area: median,
      apartments_to_close: median ? Math.round(gap / median) : null,
    },
    by_kind: byKind(premises, baseArea),
    top_silent: silentSorted.slice(0, GIS_SILENT_LIST_LIMIT).map((premise) => ({
      room: premise.room,
      cadastre: premise.cadastre,
      label: premise.label,
      area: premise.area,
      owners: premise.owners,
    })),
    silent_truncated: silentSorted.length > GIS_SILENT_LIST_LIMIT,
  };
};

/**
 * Разбор файла. `buffer` — байты .xlsx; сам разбор ничего не сохраняет и не
 * пишет на диск — это делает use-case поверх.
 */
export const analyzeGisVotingWorkbook = (buffer, { fileName = null } = {}) => {
  const workbook = readWorkbook(buffer);
  const { name: sheetName, rows } = pickSheet(workbook);

  const headerRowNumber = rows.find(([, row]) => HEADER_RE.test(cell(row, COLUMN.room)))?.[0];

  if (!headerRowNumber) {
    throw new ValidationError(
      "В файле нет реестра голосований: строка с заголовком «№ помещения» не найдена"
    );
  }

  const meta = readMetaBlock(rows, headerRowNumber);
  const ownershipRows = readOwnershipRows(rows, headerRowNumber);

  if (ownershipRows.length === 0) {
    throw new ValidationError("В файле нет ни одной строки собственника");
  }

  const groups = groupPremises(ownershipRows);
  const premises = groups.map(premiseView);
  const summary = summarizeGisPremises(premises);

  return {
    file_name: fileName,
    sheet_name: sheetName,
    meta: {
      title: meta.title,
      export_date: normalizeGisDate(meta.blocks["1"]),
      export_date_label: russianDate(normalizeGisDate(meta.blocks["1"])),
      address: meta.address,
      management_company: meta.blocks["2"] ?? null,
      inn: meta.blocks["3"] ?? null,
      house_fias: meta.blocks["4"] ?? null,
    },
    ...summary,
    fund: { ownership_rows: ownershipRows.length, ...summary.fund },
    // Плоский список помещений: из него складывает история, и же он пойдёт в CSV.
    rooms: premises,
    defects: collectDefects(groups, premises),
  };
};
