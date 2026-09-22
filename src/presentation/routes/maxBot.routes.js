import express from "express";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../../core/middlewares/checkRole.js";
import { GLOBAL_ROLES } from "../../core/utils/roles.js";
import { container } from "../../infrastructure/container/Container.js";

/**
 * Маршруты вкладки админки «MAX-бот» (mount: /api/admin/max-bot).
 *
 * Доступ: только `global:admin` (requireRoles проверяет и блокировку аккаунта).
 * Все ответы — в формате { success, data }.
 */
const router = express.Router();

const maxBotController = container.resolve("maxBotController");

router.use(authenticateJWT);
router.use(requireRoles(GLOBAL_ROLES.ADMIN));

/**
 * @route   GET /api/admin/max-bot/status
 * @desc    Статус интеграции: бот, polling, счётчики, курсор
 * @access  Private (admin only)
 */
router.get("/status", maxBotController.getStatus);

/**
 * @route   GET /api/admin/max-bot/inbox
 * @desc    Лента обращений жителей к боту (новые сверху)
 * @access  Private (admin only)
 */
router.get("/inbox", maxBotController.getInbox);

/**
 * @route   POST /api/admin/max-bot/inbox/:id/handle
 * @desc    Отметить сообщение обработанным (с заметкой)
 * @access  Private (admin only)
 */
router.post("/inbox/:id/handle", maxBotController.handleInboxMessage);

/**
 * @route   POST /api/admin/max-bot/inbox/:id/reply
 * @desc    Ответить жителю через бота и записать ответ в ленту
 * @access  Private (admin only)
 */
router.post("/inbox/:id/reply", maxBotController.replyToInboxMessage);

/**
 * @route   GET /api/admin/max-bot/audiences/preview
 * @desc    Сколько жителей получит рассылку + пример имён
 * @access  Private (admin only)
 */
router.get("/audiences/preview", maxBotController.previewAudience);

/**
 * @route   POST /api/admin/max-bot/broadcasts
 * @desc    Создать рассылку (dry_run=true — только черновик и очередь, без отправки)
 * @access  Private (admin only)
 */
router.post("/broadcasts", maxBotController.createBroadcast);

/**
 * @route   POST /api/admin/max-bot/broadcasts/:id/start
 * @desc    Запустить очередь отправки (асинхронно)
 * @access  Private (admin only)
 */
router.post("/broadcasts/:id/start", maxBotController.startBroadcast);

/**
 * @route   POST /api/admin/max-bot/broadcasts/:id/cancel
 * @desc    Отменить рассылку
 * @access  Private (admin only)
 */
router.post("/broadcasts/:id/cancel", maxBotController.cancelBroadcast);

/**
 * @route   POST /api/admin/max-bot/broadcasts/:id/retry-failed
 * @desc    Повторить неудачных и пропущенных получателей
 * @access  Private (admin only)
 */
router.post("/broadcasts/:id/retry-failed", maxBotController.retryFailedBroadcast);

/**
 * @route   GET /api/admin/max-bot/broadcasts
 * @desc    Журнал рассылок
 * @access  Private (admin only)
 */
router.get("/broadcasts", maxBotController.getBroadcasts);

/**
 * @route   GET /api/admin/max-bot/broadcasts/:id/recipients
 * @desc    Получатели рассылки с фильтром по статусу
 * @access  Private (admin only)
 */
router.get("/broadcasts/:id/recipients", maxBotController.getBroadcastRecipients);

/**
 * @route   POST /api/admin/max-bot/webhook/setup
 * @desc    Зарегистрировать webhook MAX вместо long polling (по явному действию админа)
 * @access  Private (admin only)
 */
router.post("/webhook/setup", maxBotController.setupWebhook);

export default router;
export { router as maxBotRoutes };
