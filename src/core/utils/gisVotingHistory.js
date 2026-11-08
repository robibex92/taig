/**
 * Арифметика истории голосований: что изменилось между срезами одного голосования.
 *
 * Функции чистые и ничего не знают о базе — вход плоские строки помещений,
 * выход то, что рисует вкладка. Срезы упорядочены по дате выгрузки (не по дате
 * загрузки): имя файла и момент, когда админ его принёс, про голосование не
 * говорят ничего.
 */

import { GIS_PREMISE_KINDS, summarizeGisPremises } from "./gisVotingReport.js";

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Строка `gis_vote_report_rooms` → помещение в форме, с которой работает
 * арифметика среза. Decimal из Prisma превращается в число здесь, а не в UI.
 */
export const premiseFromRoomRow = (row) => {
  const kind = row.kind;

  return {
    room: row.room_label ?? "",
    cadastre: row.cadastre ?? null,
    kind,
    label: GIS_PREMISE_KINDS[kind] ?? kind,
    area: round(row.area),
    weight: round(row.weight),
    share_sum: row.share_sum === null ? null : round(row.share_sum),
    owners: row.owners ?? 1,
    voted_owners: row.voted ? 1 : 0,
    voted: Boolean(row.voted),
    last_bulletin_date: row.last_bulletin_date
      ? new Date(row.last_bulletin_date).toISOString().slice(0, 10)
      : null,
  };
};

const isoDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

const russianDate = (iso) => {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");

  return `${day}.${month}.${year}`;
};

const basePremises = (premises) => premises.filter((premise) => premise.kind !== "common");

/**
 * Статус помещения по всем срезам голосования (V5).
 *
 * «Впервые» и «бросило» имеют смысл только когда срезов больше одного; с одним
 * срезом история ничегонеизвестна, и врать про «постоянно голосует» нельзя.
 */
const statusOf = (votedSlices, totalSlices, inLatest) => {
  if (totalSlices < 2) return inLatest ? "single" : "never";
  if (!inLatest) return votedSlices > 0 ? "stopped" : "never";
  if (votedSlices === totalSlices) return "always";
  if (votedSlices > 1) return "often";

  return "first_time";
};

export const GIS_ROOM_STATUSES = {
  always: "голосует во всех срезах",
  often: "голосует не впервые",
  first_time: "проголосовало впервые",
  stopped: "раньше голосовало, сейчас молчит",
  never: "ни разу не голосовало",
  single: "проголосовало (истории для сравнения пока нет)",
};

/** Ключ помещения в истории: кадастр; без него — метка, чтобы не схлопнуть разные. */
const roomKey = (premise) => premise.cadastre ?? `room:${premise.room}`;

/**
 * Сводка по голосованию: список срезов с дельтами, статусы помещений последнего
 * среза и доля дома, которая голосует вообще (V4).
 */
export const buildGisVotingHistory = (slices) => {
  const ordered = [...slices]
    .map((slice) => ({
      ...slice,
      exported_at: isoDate(slice.exported_at),
      premises: slice.premises.map(premiseFromRoomRow),
    }))
    .sort((a, b) => String(a.exported_at).localeCompare(String(b.exported_at)));

  const summaries = ordered.map((slice) => {
    const summary = summarizeGisPremises(slice.premises);

    return {
      id: String(slice.id),
      house: slice.house,
      title: slice.title,
      exported_at: slice.exported_at,
      exported_at_label: russianDate(slice.exported_at),
      file_name: slice.file_name,
      address: slice.address,
      uploaded_by: slice.uploaded_by === null || slice.uploaded_by === undefined ? null : String(slice.uploaded_by),
      created_at: slice.created_at ? new Date(slice.created_at).toISOString() : null,
      summary,
      defects: slice.defects ?? null,
    };
  });

  // Дельты — по соседним срезам: «в какую дату сколько проголосовало» и что
  // изменилось с прошлого раза (V8).
  const withDeltas = summaries.map((slice, index) => {
    const previous = index > 0 ? summaries[index - 1] : null;

    if (!previous) {
      return { ...slice, delta: null };
    }

    return {
      ...slice,
      delta: {
        from_exported_at: previous.exported_at,
        voted_rooms: round(
          slice.summary.participation.voted_premises - previous.summary.participation.voted_premises
        ),
        weight: round(
          slice.summary.participation.voted_weight - previous.summary.participation.voted_weight
        ),
        pct_of_base: round(
          (slice.summary.participation.pct_of_base ?? 0) -
            (previous.summary.participation.pct_of_base ?? 0)
        ),
      },
    };
  });

  const latest = ordered.at(-1) ?? null;
  const turnout = summaries.map((slice, index) => ({
    exported_at: slice.exported_at,
    exported_at_label: slice.exported_at_label,
    voted_rooms: slice.summary.participation.voted_premises,
    voted_weight: slice.summary.participation.voted_weight,
    pct_of_base: slice.summary.participation.pct_of_base,
    rooms_base: slice.summary.fund.base.premises,
    delta_voted_rooms: index > 0 ? round(slice.summary.participation.voted_premises - summaries[index - 1].summary.participation.voted_premises) : null,
  }));

  if (!latest) {
    return { slices: withDeltas, turnout, rooms: [], changes: [], participation_history: null };
  }

  const votedByRoom = new Map();

  for (const slice of ordered) {
    for (const premise of basePremises(slice.premises)) {
      const key = roomKey(premise);
      const seen = votedByRoom.get(key);

      if (seen) {
        seen.slices += premise.voted ? 1 : 0;
        if (premise.voted) seen.last_exported_at = slice.exported_at;
        continue;
      }

      votedByRoom.set(key, {
        key,
        room: premise.room,
        cadastre: premise.cadastre,
        label: premise.label,
        area: premise.area,
        slices: premise.voted ? 1 : 0,
        last_exported_at: premise.voted ? slice.exported_at : null,
      });
    }
  }

  const latestBase = basePremises(latest.premises);
  const inLatestVoted = new Set(
    latestBase.filter((premise) => premise.voted).map(roomKey)
  );

  const rooms = [...votedByRoom.values()]
    .map((room) => {
      const inLatest = inLatestVoted.has(room.key);
      const status = statusOf(room.slices, ordered.length, inLatest);
      const latestPremise = latestBase.find((premise) => roomKey(premise) === room.key);

      return {
        room: room.room,
        cadastre: room.cadastre,
        label: room.label,
        area: latestPremise ? latestPremise.area : room.area,
        weight: latestPremise ? latestPremise.weight : 0,
        owners: latestPremise ? latestPremise.owners : 1,
        voted: inLatest,
        voted_slices: room.slices,
        last_voted_at: room.last_exported_at,
        status,
        status_label: GIS_ROOM_STATUSES[status],
      };
    })
    .sort((a, b) => b.area - a.area);

  const statusCounts = rooms.reduce((counts, room) => {
    counts[room.status] = (counts[room.status] ?? 0) + 1;

    return counts;
  }, {});

  const everVoted = rooms.filter((room) => room.voted_slices > 0);
  const latestArea = round(latestBase.reduce((total, premise) => total + premise.area, 0));

  return {
    slices: withDeltas,
    turnout,
    rooms,
    // Кто пришёл и кто ушёл между соседними срезами — считается по уже
    // разобранным помещениям, а не по сырым строкам БД с Decimal-площадями.
    changes: ordered.slice(1).map((current, index) => compareGisSlices(ordered[index], current)),
    participation_history: {
      slices: ordered.length,
      comparable: ordered.length > 1,
      rooms_total: rooms.length,
      ever_voted: everVoted.length,
      ever_voted_pct: rooms.length ? round((100 * everVoted.length) / rooms.length) : null,
      ever_voted_area: round(everVoted.reduce((total, room) => total + room.area, 0)),
      never_voted_area: round(
        latestArea - latestBase.filter((p) => p.voted).reduce((t, p) => t + p.area, 0)
      ),
      always_voted: statusCounts.always ?? 0,
      first_time: statusCounts.first_time ?? 0,
      stopped: statusCounts.stopped ?? 0,
      never: statusCounts.never ?? 0,
      status_counts: statusCounts,
    },
  };
};

/**
 * Сравнение двух срезов: кто added, кто выпал, кто с обеими датами.
 * Нужен, чтобы показать немонотонность явки между выгрузками.
 */
export const compareGisSlices = (previous, current) => {
  const keySet = (premises) =>
    new Set(basePremises(premises).filter((premise) => premise.voted).map(roomKey));

  const before = keySet(previous.premises);
  const now = keySet(current.premises);

  const added = current.premises.filter((p) => now.has(roomKey(p)) && !before.has(roomKey(p)));
  const dropped = previous.premises.filter((p) => before.has(roomKey(p)) && !now.has(roomKey(p)));
  const both = current.premises.filter((p) => now.has(roomKey(p)) && before.has(roomKey(p)));

  const area = (list) => round(list.reduce((total, premise) => total + premise.area, 0));

  return {
    previous_exported_at: isoDate(previous.exported_at),
    current_exported_at: isoDate(current.exported_at),
    added: { rooms: added.length, area: area(added) },
    dropped: { rooms: dropped.length, area: area(dropped) },
    both: { rooms: both.length, area: area(both) },
  };
};
