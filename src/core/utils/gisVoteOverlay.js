/**
 * Наложение среза ГИС ЖКХ на сетку квартир («Привет, сосед»).
 *
 * Соединение возможно только по номеру помещения: в `houses` нет ни
 * кадастрового номера, ни номера собственности, а в выгрузке нет наших id.
 * Отсюда два ограничения, которые нельзя прятать:
 *
 * 1. нечисловые метки (`Оф. 1`, `кладовая 12К`) и два безымянных нежилых ни в
 *    одну ячейку не попадают — они уходят в `off_grid`, а не молча отбрасываются;
 * 2. «проголосовала квартира» и «проголосовала доля» — разные утверждения: у 40
 *    помещений 2–5 совладельцев, поэтому в ячейке живёт вес доли, а не галочка.
 *
 * Совпадение ищется по нормализованной метке (пробелы, регистр), иначе `Оф. 1`
 * и `ОФ.1` из разных выгрузок считаются разными помещениями.
 */

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const toNumber = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLabel = (value) =>
  String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();

const isoDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

const russianDate = (iso) => {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");

  return `${day}.${month}.${year}`;
};

/**
 * Сколько разных голосований дома, где помещение участвовало: ключ —
 * нормализованная метка, значение — число названий. Два среза одного ОСС дают
 * одно голосование, а не два: «участие» считается по голосованиям, а не по
 * количеству выгрузок.
 */
export const countVotedTitlesByLabel = (rows) => {
  const byLabel = new Map();

  for (const row of rows ?? []) {
    const label = normalizeLabel(row.room_label);
    const title = row.report?.title;

    if (!label || !title) continue;

    if (!byLabel.has(label)) byLabel.set(label, new Set());
    byLabel.get(label).add(title);
  }

  return byLabel;
};

/**
 * @param {object} report  строка `gis_vote_reports` (без помещений)
 * @param {Array} rooms    строки `gis_vote_report_rooms` того же среза
 * @param {Array} apartments квартиры сетки этого дома: [{ id, number }]
 * @param {Map} votes      результат `countVotedTitlesByLabel` по всему дому
 */
export const buildGisVoteOverlay = ({ report, rooms, apartments, votes = new Map() }) => {
  const exportedAt = isoDate(report.exported_at);
  const areaBase = toNumber(report.area_base) ?? 0;
  const weightVoted = toNumber(report.weight_voted) ?? 0;

  const byLabel = new Map();

  for (const room of rooms) {
    const label = normalizeLabel(room.room_label);
    if (!label) continue;

    const existing = byLabel.get(label);

    if (existing) {
      // Один номер на два разных кадастра — в доме с подъездами это возможно.
      // Молча выбрать один было бы хуже: площадь, вес и совладельцы складываются,
      // а помещение попадает в `ambiguous`, чтобы интерфейс не выдавал это за
      // одну квартиру.
      existing.collided = true;
      existing.voted = existing.voted || Boolean(room.voted);
      existing.weight = round(existing.weight + (toNumber(room.weight) ?? 0));
      existing.area = round(existing.area + (toNumber(room.area) ?? 0));
      existing.owners += room.owners ?? 1;
      continue;
    }

    byLabel.set(label, {
      room_label: String(room.room_label).trim(),
      cadastre: room.cadastre ?? null,
      kind: room.kind,
      in_base: room.kind !== "common",
      area: round(toNumber(room.area) ?? 0),
      weight: round(toNumber(room.weight) ?? 0),
      owners: room.owners ?? 1,
      voted: Boolean(room.voted),
      collided: false,
    });
  }

  const cells = [];
  const matched = new Set();

  for (const apartment of apartments) {
    const label = normalizeLabel(apartment.number);
    const premise = byLabel.get(label);

    if (!premise) continue;

    matched.add(label);
    cells.push({
      id: apartment.id === null || apartment.id === undefined ? null : String(apartment.id),
      number: String(apartment.number).trim(),
      voted: premise.voted,
      votes: votes.get(label)?.size ?? 0,
      // Доля квартиры в весе базы — то, сколько она приносит кворуму. Считается
      // здесь, а не на фронте: сервер решает форму ответа.
      share_pct: areaBase > 0 ? round((100 * premise.area) / areaBase) : null,
      weight: premise.weight,
      area: premise.area,
      owners: premise.owners,
      cadastre: premise.cadastre,
    });
  }

  return {
    slice: {
      house: report.house,
      title: report.title,
      exported_at: exportedAt,
      exported_at_label: russianDate(exportedAt),
      rooms_total: report.rooms_total,
      rooms_base: report.rooms_base,
      rooms_voted: report.rooms_voted,
      pct_of_base: areaBase > 0 ? round((100 * weightVoted) / areaBase) : null,
    },
    cells,
    // Помещения среза, которым не нашлось ячейки: не совпавшие метки плюс те,
    // у чего метки нет вовсе (общее имущество).
    off_grid: [...byLabel.values()]
      .filter((premise) => !matched.has(normalizeLabel(premise.room_label)))
      .map((premise) => ({
        room: premise.room_label,
        cadastre: premise.cadastre,
        kind: premise.kind,
        area: premise.area,
        weight: premise.weight,
        voted: premise.voted,
      }))
      .sort((a, b) => b.area - a.area),
    ambiguous: [...byLabel.values()]
      .filter((premise) => premise.collided)
      .map((premise) => ({ room: premise.room_label, area: premise.area, owners: premise.owners })),
  };
};
