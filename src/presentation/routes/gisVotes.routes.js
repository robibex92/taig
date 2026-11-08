import express from "express";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../../core/middlewares/checkRole.js";
import { GLOBAL_ROLES } from "../../core/utils/roles.js";
import { uploadLimiter } from "../middlewares/securityMiddleware.js";
import { gisWorkbookUpload } from "../../core/middlewares/gisWorkbookUpload.js";
import { container } from "../../infrastructure/container/Container.js";

/**
 * Маршруты раздела админки «Голосование дома» (mount: /api/admin/gis-votes).
 *
 * Право одно — `global:admin`: в выгрузке номера собственности и кадастровые
 * номера, то есть данные, которыми помещение связывается с владельцем через
 * Росреестр. Модератору раздел не открывается.
 *
 * `/analyze` ничего не сохраняет — это просмотр файла. История живёт в
 * `/reports`: срез опознаётся тройкой (дом, название голосования, дата
 * выгрузки), и повторная загрузка того же файла заменяет строки, а не плодит
 * дубликат.
 */
const router = express.Router();

const gisVoteController = container.resolve("gisVoteController");

router.use(authenticateJWT);
router.use(requireRoles(GLOBAL_ROLES.ADMIN));

/**
 * @route   POST /api/admin/gis-votes/analyze
 * @desc    Разобрать выгрузку .xlsx и отдать статистику, ничего не сохраняя
 * @access  Private (admin only)
 */
router.post("/analyze", uploadLimiter, gisWorkbookUpload, gisVoteController.analyze);

/**
 * @route   POST /api/admin/gis-votes/reports
 * @desc    Разобрать выгрузку и сохранить срез в историю (поля house, title)
 * @access  Private (admin only)
 */
router.post("/reports", uploadLimiter, gisWorkbookUpload, gisVoteController.saveReport);

/**
 * @route   GET /api/admin/gis-votes/reports
 * @desc    Список сохранённых срезов; фильтры ?house= и ?title=
 * @access  Private (admin only)
 */
router.get("/reports", gisVoteController.listReports);

/**
 * @route   GET /api/admin/gis-votes/reports/:id
 * @desc    Один срез целиком — те же поля, что отдаёт разбор файла
 * @access  Private (admin only)
 */
router.get("/reports/:id", gisVoteController.getReport);

/**
 * @route   DELETE /api/admin/gis-votes/reports/:id
 * @desc    Удалить срез вместе с его помещениями
 * @access  Private (admin only)
 */
router.delete("/reports/:id", gisVoteController.removeReport);

/**
 * @route   GET /api/admin/gis-votes/history
 * @desc    История голосования: ?house=&title= → срезы по датам, статусы помещений, дельты
 * @access  Private (admin only)
 */
router.get("/history", gisVoteController.history);

/**
 * @route   GET /api/admin/gis-votes/titles
 * @desc    Названия голосований, которые уже вводились (?house= — по одному дому)
 * @access  Private (admin only)
 */
router.get("/titles", gisVoteController.titles);

/**
 * @route   GET /api/admin/gis-votes/houses
 * @desc    Справочник домов для селектора (тот же список, что у «Привет, сосед»)
 * @access  Private (admin only)
 */
router.get("/houses", gisVoteController.houses);

export default router;
