import { NotFoundError, ValidationError } from "../../../core/errors/AppError.js";
import {
  analyzeGisVotingWorkbook,
  summarizeGisPremises,
} from "../../../core/utils/gisVotingReport.js";
import { buildGisVotingHistory, premiseFromRoomRow } from "../../../core/utils/gisVotingHistory.js";
import { GisVoteRepository } from "../../../infrastructure/repositories/GisVoteRepository.js";
import { HouseRepository } from "../../../infrastructure/repositories/HouseRepository.js";

/**
 * Раздел админки «Голосование дома»: сохранение разборов и история по ним.
 *
 * Срез опознаётся тройкой (дом, название голосования, дата выгрузки). Дом
 * берётся из готового справочника `houses.house`, а название админ выбирает из
 * тех, что вводил раньше, или вводит своё: в файле ГИС нет ни номера ОСС, ни
 * повестки, поэтому придумать имя за нас сервер не может.
 */

const MAX_TITLE_LENGTH = 200;

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

const isoDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

const russianDate = (iso) => {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");

  return `${day}.${month}.${year}`;
};

const percentOf = (value, base) =>
  base > 0 ? Math.round((100 * value) / base * 100) / 100 : null;

/** Краткая строка истории: её рисует список срезов и подписывает переключатель дат. */
const serializeSlice = (row) => {
  const exportedAt = isoDate(row.exported_at);
  const areaBase = toNumber(row.area_base) ?? 0;
  const weightVoted = toNumber(row.weight_voted) ?? 0;

  return {
    id: String(row.id),
    house: row.house,
    title: row.title,
    exported_at: exportedAt,
    exported_at_label: russianDate(exportedAt),
    file_name: row.file_name,
    address: row.address,
    uploaded_by: row.uploaded_by === null || row.uploaded_by === undefined ? null : String(row.uploaded_by),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    rooms_total: row.rooms_total,
    rooms_base: row.rooms_base,
    rooms_voted: row.rooms_voted,
    owners_voted: row.owners_voted,
    area_total: toNumber(row.area_total),
    area_base: areaBase,
    area_common: toNumber(row.area_common),
    weight_voted: weightVoted,
    pct_of_base: percentOf(weightVoted, areaBase),
    ownership_rows: row.ownership_rows,
  };
};

/**
 * Полный отчёт: те же поля, что отдаёт разбор файла. Арифметика среза считается
 * заново по сохранённым помещениям через `summarizeGisPremises` — тот же код,
 * что и на пути без базы, поэтому цифры «до сохранения» и «из истории» не
 * расходятся.
 */
const serializeReport = (row) => {
  const premises = (row.rooms ?? []).map(premiseFromRoomRow);
  const summary = summarizeGisPremises(premises);
  const exportedAt = isoDate(row.exported_at);

  return {
    ...serializeSlice(row),
    export_date: exportedAt,
    export_date_label: russianDate(exportedAt),
    sheet_name: null,
    meta: {
      title: null,
      export_date: exportedAt,
      export_date_label: russianDate(exportedAt),
      address: row.address,
      management_company: row.management_company,
      inn: row.inn,
      house_fias: row.house_fias,
    },
    ...summary,
    fund: { ownership_rows: row.ownership_rows, ...summary.fund },
    defects: row.defects ?? null,
  };
};

export class GisVoteAdminUseCases {
  constructor({
    reports = new GisVoteRepository(),
    houses = new HouseRepository(),
  } = {}) {
    this.reports = reports;
    this.houses = houses;
  }

  /**
   * Разобрать файл и положить срез в историю.
   *
   * Дом проверяется по справочнику: история, привязанная к несуществующему
   * дому, не сойдётся ни с сеткой квартир, ни с рассылкой.
   */
  async saveReport({ buffer, fileName = null, house, title, uploadedBy = null }) {
    const trimmedTitle = String(title ?? "").trim();
    const trimmedHouse = String(house ?? "").trim();

    if (!buffer) throw new ValidationError("Файл не пришёл: выберите выгрузку .xlsx");
    if (!trimmedHouse) throw new ValidationError("Не выбран дом");

    if (!trimmedTitle) {
      throw new ValidationError("Нужно название голосования — в файле его нет");
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      throw new ValidationError(`Название длиннее ${MAX_TITLE_LENGTH} символов`);
    }

    const knownHouses = await this.houses.findUniqueHouses();

    if (!knownHouses.map((value) => String(value)).includes(trimmedHouse)) {
      throw new ValidationError(`Дома «${trimmedHouse}» в справочнике домов нет`);
    }

    const report = analyzeGisVotingWorkbook(buffer, { fileName });

    if (!report.meta.export_date) {
      throw new ValidationError(
        "В файле нет даты выгрузки (блок 1.1) — привязать срез к истории нельзя"
      );
    }

    const saved = await this.reports.saveSlice({
      house: trimmedHouse,
      title: trimmedTitle,
      report,
      rooms: report.rooms,
      uploadedBy,
    });

    return { slice: serializeSlice(saved.report), replaced: saved.replaced };
  }

  async listSlices({ house = null, title = null } = {}) {
    const rows = await this.reports.list({ house: house ? String(house) : null, title: title || null });

    return rows.map(serializeSlice);
  }

  async getReport(id) {
    const row = await this.reports.getById(id);

    if (!row) throw new NotFoundError("Отчёт не найден");

    return serializeReport(row);
  }

  async removeReport(id) {
    const row = await this.reports.getById(id);

    if (!row) throw new NotFoundError("Отчёт не найден");

    await this.reports.delete(id);

    return { deleted: String(id) };
  }

  /** Названия голосований, уже вводившиеся (по дому — чтобы список не распухал). */
  async titles({ house = null } = {}) {
    return this.reports.titles({ house: house ? String(house) : null });
  }

  /**
   * История голосования: срезы по датам, дельты между соседними, статусы
   * помещений последнего среза и доля дома, которая голосует вообще.
   */
  async history({ house, title }) {
    const trimmedHouse = String(house ?? "").trim();
    const trimmedTitle = String(title ?? "").trim();

    if (!trimmedHouse || !trimmedTitle) {
      throw new ValidationError("История строится по дому и названию голосования");
    }

    const rows = await this.reports.listWithRooms({ house: trimmedHouse, title: trimmedTitle });

    // Пустой список — это не 404: название голосования админ мог ещё не
    // загружать, и вкладка показывает спокойную подсказку вместо ошибки.

    const slices = rows.map((row) => ({
      id: row.id,
      house: row.house,
      title: row.title,
      exported_at: row.exported_at,
      file_name: row.file_name,
      address: row.address,
      uploaded_by: row.uploaded_by,
      created_at: row.created_at,
      defects: row.defects,
      premises: row.rooms ?? [],
    }));

    const history = buildGisVotingHistory(slices);

    return {
      house: trimmedHouse,
      title: trimmedTitle,
      ...history,
      known_houses: await this.knownHouses(),
    };
  }

  /** Справочник домов для селектора: то же, что видит «Привет, сосед». */
  async knownHouses() {
    const houses = await this.houses.findUniqueHouses();

    return houses.map((value) => String(value));
  }
}
