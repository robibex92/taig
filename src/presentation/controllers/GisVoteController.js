import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";
import { validate } from "../../core/validation/validator.js";
import { gisHouseVoteQuerySchema } from "../../core/validation/schemas/house.schema.js";
import { analyzeGisVotingWorkbook } from "../../core/utils/gisVotingReport.js";

/**
 * Контроллер раздела админки «Голосование дома».
 *
 * Два лица: `analyze`/`saveReport`/`history` — раздел админки (путь бандла A и
 * история бандла Б, всё под `global:admin`), и `gridSummary` — наложение
 * последнего среза на сетку квартир (`canViewHouse`, монтируется в
 * `routes/nearby.routes.js`). Право на данные косвенно персональные: в выгрузке
 * номера собственности и кадастровые номера, которыми помещение связывается с
 * владельцем через Росреестр.
 */

const ok = (res, data) => res.json({ success: true, data });

const toId = (value) => {
  const text = String(value ?? "").trim();

  if (!/^\d+$/.test(text)) throw new ValidationError(`Некорректный id отчёта: ${text}`);

  return text;
};

/** Значение поля multipart-формы (multer кладёт текстовые поля в req.body). */
const field = (body, name) => String(body?.[name] ?? "").trim();

export class GisVoteController {
  constructor({ adminUseCases, houseVoteUseCase }) {
    this.admin = adminUseCases;
    this.houseVote = houseVoteUseCase;
  }

  /** POST /analyze — разобрать и показать, ничего не сохраняя. */
  analyze = asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError("Файл не пришёл: выберите выгрузку .xlsx");

    const report = analyzeGisVotingWorkbook(req.file.buffer, {
      fileName: req.file.originalname,
    });

    logger.info("GIS voting workbook analyzed", {
      fileName: req.file.originalname,
      size: req.file.size,
      premises: report.fund.premises,
      voted: report.participation.voted_premises,
      user_id: req.user?.user_id,
    });

    ok(res, report);
  });

  /** POST /reports — разобрать и положить срез в историю. */
  saveReport = asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError("Файл не пришёл: выберите выгрузку .xlsx");

    const saved = await this.admin.saveReport({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      house: field(req.body, "house"),
      title: field(req.body, "title"),
      uploadedBy: req.user?.user_id ?? null,
    });

    logger.info("GIS voting slice saved", {
      house: saved.slice.house,
      title: saved.slice.title,
      exported_at: saved.slice.exported_at,
      rooms_voted: saved.slice.rooms_voted,
      replaced: saved.replaced,
      user_id: req.user?.user_id,
    });

    ok(res, saved);
  });

  /** GET /reports?house=&title= */
  listReports = asyncHandler(async (req, res) => {
    ok(
      res,
      await this.admin.listSlices({
        house: field(req.query, "house") || null,
        title: field(req.query, "title") || null,
      })
    );
  });

  /** GET /reports/:id — один срез целиком, в форме разбора файла. */
  getReport = asyncHandler(async (req, res) => {
    ok(res, await this.admin.getReport(toId(req.params.id)));
  });

  /** DELETE /reports/:id */
  removeReport = asyncHandler(async (req, res) => {
    ok(res, await this.admin.removeReport(toId(req.params.id)));
  });

  /** GET /history?house=&title= — срезы по датам, статусы помещений, дельты. */
  history = asyncHandler(async (req, res) => {
    ok(
      res,
      await this.admin.history({
        house: field(req.query, "house"),
        title: field(req.query, "title"),
      })
    );
  });

  /** GET /titles?house= — названия голосований, которые админ уже вводил. */
  titles = asyncHandler(async (req, res) => {
    ok(res, await this.admin.titles({ house: field(req.query, "house") || null }));
  });

  /** GET /houses — справочник домов для селектора. */
  houses = asyncHandler(async (req, res) => {
    ok(res, await this.admin.knownHouses());
  });

  /**
   * GET /nearby/gis-vote?house= — наложение последнего среза на сетку квартир.
   * Право не `global:admin`, а `canViewHouse`: старшему по дому его квартиры
   * видны, чужому дома — нет. Ответ `null` означает «вам этих данных не
   * показывают», и интерфейс тогда просто рисует обычную сетку.
   */
  gridSummary = asyncHandler(async (req, res) => {
    const { house } = validate(gisHouseVoteQuerySchema, req.query);

    res.json({ success: true, data: await this.houseVote.execute({ house, viewer: req.user ?? null }) });
  });
}
