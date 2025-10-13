import express from "express";
import container from "../../infrastructure/container/Container.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();
const telegramChatController = container.resolve("telegramChatController");

/**
 * @swagger
 * tags:
 *   name: TelegramChats
 *   description: Telegram chat management API
 */

/**
 * @swagger
 * /api-v1/telegram-chats:
 *   get:
 *     summary: Get all Telegram chats
 *     tags: [TelegramChats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: purpose
 *         schema:
 *           type: string
 *           enum: [ads, news, general, notifications]
 *         description: Filter by purpose
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *         description: Return only active chats
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get("/", authenticate, telegramChatController.getChats);

/**
 * @swagger
 * /api-v1/telegram-chats:
 *   post:
 *     summary: Create new Telegram chat
 *     tags: [TelegramChats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chat_id
 *               - name
 *             properties:
 *               chat_id:
 *                 type: string
 *               thread_id:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               chat_type:
 *                 type: string
 *                 enum: [group, channel, supergroup]
 *               is_active:
 *                 type: boolean
 *               purpose:
 *                 type: string
 *                 enum: [ads, news, general, notifications]
 *     responses:
 *       201:
 *         description: Created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/",
  authenticate,
  authorize("admin"),
  telegramChatController.createChat
);

/**
 * @swagger
 * /api-v1/telegram-chats/{id}:
 *   patch:
 *     summary: Update Telegram chat
 *     tags: [TelegramChats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  telegramChatController.updateChat
);

/**
 * @swagger
 * /api-v1/telegram-chats/{id}:
 *   delete:
 *     summary: Delete Telegram chat
 *     tags: [TelegramChats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  telegramChatController.deleteChat
);

/**
 * @swagger
 * /api-v1/telegram-chats/{id}/toggle-active:
 *   patch:
 *     summary: Toggle chat active status
 *     tags: [TelegramChats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch(
  "/:id/toggle-active",
  authenticate,
  authorize("admin"),
  telegramChatController.toggleActive
);

export default router;
