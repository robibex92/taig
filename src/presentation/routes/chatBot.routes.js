import express from "express";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../../core/middlewares/checkRole.js";
import { GLOBAL_ROLES } from "../../core/utils/roles.js";
import { container } from "../../infrastructure/container/Container.js";

/**
 * Маршруты раздела админки «Боты в чатах» (mount: /api/admin/chat-bots).
 *
 * Доступ: только `global:admin` — это настройка поведения ботов в чатах
 * жильцов, а не контент. Все ответы в формате { success, data }.
 *
 * Условия автоответа и напоминания обращаются к чатам по id ЗАПИСЕЙ реестров
 * (`telegram_chats.id` / `max_chats.id`): адрес канала сервер берёт из базы,
 * поэтому вписать в запрос чужой chat_id нельзя.
 */
const router = express.Router();

const chatBotController = container.resolve("chatBotController");

router.use(authenticateJWT);
router.use(requireRoles(GLOBAL_ROLES.ADMIN));

/**
 * @route   GET /api/admin/chat-bots/auto-replies
 * @desc    Список условий автоответа (фильтр ?platform=telegram|max)
 * @access  Private (admin only)
 */
router.get("/auto-replies", chatBotController.listAutoReplies);

/**
 * @route   POST /api/admin/chat-bots/auto-replies
 * @desc    Создать условие: фраза в чате → ответ бота
 * @access  Private (admin only)
 */
router.post("/auto-replies", chatBotController.createAutoReply);

/**
 * @route   PATCH /api/admin/chat-bots/auto-replies/:id
 * @desc    Изменить фразу, ответ или включённость условия
 * @access  Private (admin only)
 */
router.patch("/auto-replies/:id", chatBotController.updateAutoReply);

/**
 * @route   DELETE /api/admin/chat-bots/auto-replies/:id
 * @desc    Удалить условие автоответа
 * @access  Private (admin only)
 */
router.delete("/auto-replies/:id", chatBotController.deleteAutoReply);

/**
 * @route   GET /api/admin/chat-bots/reminders
 * @desc    Список напоминаний с описанием расписания и последним результатом
 * @access  Private (admin only)
 */
router.get("/reminders", chatBotController.listReminders);

/**
 * @route   GET /api/admin/chat-bots/reminders/preview
 * @desc    Когда сработает такое расписание в поясе REMINDER_TZ (без отправки)
 * @access  Private (admin only)
 */
router.get("/reminders/preview", chatBotController.previewReminder);

/**
 * @route   POST /api/admin/chat-bots/reminders
 * @desc    Создать напоминание в чат из реестра
 * @access  Private (admin only)
 */
router.post("/reminders", chatBotController.createReminder);

/**
 * @route   PATCH /api/admin/chat-bots/reminders/:id
 * @desc    Изменить напоминание
 * @access  Private (admin only)
 */
router.patch("/reminders/:id", chatBotController.updateReminder);

/**
 * @route   DELETE /api/admin/chat-bots/reminders/:id
 * @desc    Удалить напоминание
 * @access  Private (admin only)
 */
router.delete("/reminders/:id", chatBotController.deleteReminder);

export default router;
export { router as chatBotRoutes };
