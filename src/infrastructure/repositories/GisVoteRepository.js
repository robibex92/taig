import { prisma } from "../database/prisma.js";

/**
 * История разборов выгрузок ГИС ЖКХ (`gis_vote_reports` + `gis_vote_report_rooms`).
 *
 * Срез опознаётся тройкой (дом, название голосования, дата выгрузки), поэтому
 * повторная загрузка того же файла не заводит вторую запись, а заменяет
 * разобранные строки — править правила разбора и пересобирать историю можно,
 * не накапливая дубликаты. Оригиналы файлов здесь не хранятся сознательно.
 *
 * Дробные площади и веса пишутся строками (как `price_value` в объявлениях):
 * Prisma иначе отдаёт объект Decimal, а сравнения и суммы в UI нужны числа.
 */

const toDecimal = (value) => String(value ?? 0);

const toDate = (isoDate) => (isoDate ? new Date(`${isoDate}T00:00:00.000Z`) : null);

const roomData = (reportId, room) => ({
  report_id: BigInt(reportId),
  cadastre: room.cadastre ?? null,
  room_label: room.room ?? null,
  kind: room.kind,
  in_base: room.kind !== "common",
  owners: room.owners ?? 1,
  area: toDecimal(room.area),
  weight: toDecimal(room.weight),
  share_sum: room.share_sum === null || room.share_sum === undefined ? null : toDecimal(room.share_sum),
  voted: Boolean(room.voted),
  last_bulletin_date: toDate(room.last_bulletin_date),
});

export class GisVoteRepository {
  /**
   * Сохранить (или перезаписать) срез вместе с помещениями одной транзакцией:
   * половине среза в истории смысла нет — цифры перестанут сходиться.
   *
   * `report` — результат разбора (`analyzeGisVotingWorkbook`), `rooms` — те же
   * помещения в плоском виде: их и читаем обратно, и сравниваем срезы между собой.
   */
  async saveSlice({ house, title, report, rooms, uploadedBy = null }) {
    const key = {
      house_title_exported_at: {
        house,
        title,
        exported_at: toDate(report.meta.export_date),
      },
    };

    const data = {
      house,
      title,
      exported_at: toDate(report.meta.export_date),
      file_name: report.file_name ?? null,
      address: report.meta.address ?? null,
      house_fias: report.meta.house_fias ?? null,
      inn: report.meta.inn ?? null,
      management_company: report.meta.management_company ?? null,
      ownership_rows: report.fund.ownership_rows,
      rooms_total: report.fund.premises,
      area_total: toDecimal(report.fund.area_total),
      rooms_base: report.fund.base.premises,
      area_base: toDecimal(report.fund.base.area),
      area_common: toDecimal(report.fund.common.area),
      rooms_voted: report.participation.voted_premises,
      owners_voted: report.participation.voted_owners,
      weight_voted: toDecimal(report.participation.voted_weight),
      defects: report.defects ?? {},
      uploaded_by: uploadedBy === null || uploadedBy === undefined ? null : BigInt(uploadedBy),
    };

    return prisma.$transaction(async (tx) => {
      const existing = await tx.gisVoteReport.findUnique({ where: key, select: { id: true } });

      const report = existing
        ? await tx.gisVoteReport.update({ where: { id: existing.id }, data })
        : await tx.gisVoteReport.create({ data });

      await tx.gisVoteReportRoom.deleteMany({ where: { report_id: report.id } });
      await tx.gisVoteReportRoom.createMany({
        data: rooms.map((room) => roomData(report.id, room)),
      });

      return { report, replaced: Boolean(existing) };
    });
  }

  async list({ house = null, title = null, limit = 200 } = {}) {
    const where = {};

    if (house) where.house = house;
    if (title) where.title = title;

    return prisma.gisVoteReport.findMany({
      where,
      orderBy: [{ exported_at: "desc" }, { id: "desc" }],
      take: limit,
    });
  }

  async getById(id) {
    return prisma.gisVoteReport.findUnique({
      where: { id: BigInt(id) },
      include: { rooms: { orderBy: [{ room_label: "asc" }, { id: "asc" }] } },
    });
  }

  /**
   * Срезы вместе с помещениями — одним запросом, потому что история строится
   * по всем срезам голосования сразу и N+1 на 560 помещений был бы заметен.
   */
  async listWithRooms({ house = null, title = null } = {}) {
    const where = {};

    if (house) where.house = house;
    if (title) where.title = title;

    return prisma.gisVoteReport.findMany({
      where,
      include: { rooms: true },
      orderBy: [{ exported_at: "desc" }, { id: "desc" }],
    });
  }

  async delete(id) {
    // Помещения уходят вместе с отчётом: ON DELETE CASCADE в миграции.
    return prisma.gisVoteReport.delete({ where: { id: BigInt(id) } });
  }

  /** Названия голосований, которые админ уже вводил, — для подсказки при загрузке. */
  async titles({ house = null } = {}) {
    const rows = await prisma.gisVoteReport.findMany({
      where: house ? { house } : {},
      distinct: ["title"],
      orderBy: { title: "asc" },
      select: { title: true },
    });

    return rows.map((row) => row.title);
  }

  /**
   * Дом, по которому история уже есть.
   */
  async houses() {
    const rows = await prisma.gisVoteReport.findMany({
      distinct: ["house"],
      orderBy: { house: "asc" },
      select: { house: true },
    });

    return rows.map((row) => row.house);
  }

  /**
   * Последний по дате выгрузки срез дома вместе с помещениями — он и красится
   * на сетке квартир. Среди нескольких голосований берётся самый свежий срез:
   * «проголосовала» без подписи, к какому именно, на сетке означало бы только
   * вред, поэтому вместе с ним наружу уходят название и дата.
   */
  async latestSliceByHouse(house) {
    const key = String(house ?? "").trim();
    if (!key) return null;

    return prisma.gisVoteReport.findFirst({
      where: { house: key },
      orderBy: [{ exported_at: "desc" }, { id: "desc" }],
      include: { rooms: true },
    });
  }

  /**
   * Помещения дома, по которым есть хоть один бюллетень, с названием их
   * голосования — на этом считается «участие в N голосованиях» конкретной
   * квартиры. Молчащие строки не выбираем: их счётчик и так ноль.
   */
  async votedRoomsByHouse(house) {
    const key = String(house ?? "").trim();
    if (!key) return [];

    return prisma.gisVoteReportRoom.findMany({
      where: { voted: true, report: { house: key } },
      select: { room_label: true, report: { select: { title: true } } },
    });
  }
}
