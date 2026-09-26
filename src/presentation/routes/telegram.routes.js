import express from "express";
import container from "../../infrastructure/container/Container.js";
import { authenticateConditional } from "../middlewares/authMiddleware.js";
import { feedbackLimiter } from "../middlewares/securityMiddleware.js";
import { validate } from "../../core/validation/validator.js";
import Joi from "joi";
import { logger } from "../../core/utils/logger.js";
import { prisma } from "../../infrastructure/database/db.js";

const router = express.Router();
const telegramService = container.resolve("telegramService");

const BASE_ROUTE = "/telegram";

/**
 * @swagger
 * tags:
 *   name: Telegram
 *   description: Telegram messaging API
 */

/**
 * Обратная связь с сайта. Адресат берётся только отсюда: пока `chat_id`
 * приходил из тела, эндпоинт был ретранслятором в любой чат Telegram.
 * Личные сообщения жителям идут через `/api/contacts/send`.
 */
const FEEDBACK_CHAT_ID = process.env.ADMIN_FEEDBACK_CHAT_ID || "245946670";

// Validation schema for the feedback message
const sendMessageSchema = Joi.object({
  message: Joi.string().min(1).max(4096).required().messages({
    "any.required": "message is required",
    "string.max": "Message cannot exceed 4096 characters",
  }),
  parse_mode: Joi.string().valid("HTML").default("HTML"),
  captcha: Joi.string().messages({
    "any.required": "Captcha is required for feedback messages",
  }),
});

/**
 * @swagger
 * /api-v1/telegram/send:
 *   post:
 *     summary: Feedback message to the administration chat
 *     tags: [Telegram]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               captcha:
 *                 type: string
 *                 description: обязателен для анонимной отправки
 *               parse_mode:
 *                 type: string
 *                 enum: [HTML]
 *                 default: HTML
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal Server Error
 */
router.post(
  `${BASE_ROUTE}/send`,
  authenticateConditional,
  feedbackLimiter,
  async (req, res, next) => {
    try {
      const { message, parse_mode, captcha } = validate(sendMessageSchema, req.body);

      // Get user_id from token (may be null for anonymous feedback)
      const user_id = req.user?.user_id;

      // Простая проверка капчи для анонимной обратной связи: в реальном
      // приложении здесь должна быть настоящая проверка, пока — только длина.
      if (!user_id && (!captcha || captcha.length !== 5)) {
        return res.status(400).json({
          success: false,
          error: "Invalid captcha",
        });
      }

      logger.info("Feedback message request", {
        user_id,
        isAuthenticated: !!user_id,
      });

      // Get username from database if user is authenticated
      let dbUsername = null;
      if (user_id) {
        try {
          const user = await prisma.user.findUnique({
            where: { user_id: BigInt(user_id) },
            select: { username: true },
          });
          dbUsername = user?.username || null;
        } catch (error) {
          logger.error("Error fetching username", {
            user_id,
            error: error.message,
          });
        }
      }

      const finalMessage = telegramService.buildContextMessage({
        message,
        contextType: "feedback",
        contextData: null,
        user_id,
        dbUsername,
      });

      const result = await telegramService.sendMessage({
        message: finalMessage,
        chatIds: [FEEDBACK_CHAT_ID],
        parse_mode,
      });

      if (result.results[0].error) {
        throw new Error(result.results[0].error);
      }

      logger.info("Feedback message sent successfully");

      res.json({
        success: true,
        result: result.results[0],
      });
    } catch (error) {
      logger.error("Error sending feedback message", {
        error: error.message,
      });
      next(error);
    }
  }
);

export default router;
