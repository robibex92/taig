import express from "express";
import container from "../../infrastructure/container/Container.js";
import { authenticateConditional } from "../middlewares/authMiddleware.js";
import { API_PREFIX, API_VERSION } from "../../core/constants/index.js";
import { validate } from "../../core/validation/validator.js";
import Joi from "joi";
import { logger } from "../../core/utils/logger.js";
import { prisma } from "../../infrastructure/database/db.js";

const router = express.Router();
const telegramService = container.resolve("telegramService");

const BASE_ROUTE = `${API_PREFIX}/${API_VERSION}/telegram`;

/**
 * @swagger
 * tags:
 *   name: Telegram
 *   description: Telegram messaging API
 */

// Validation schema for send message
const sendMessageSchema = Joi.object({
  chat_id: Joi.alternatives()
    .try(Joi.number(), Joi.string())
    .required()
    .messages({
      "any.required": "chat_id is required",
    }),
  message: Joi.string().min(1).max(4096).required().messages({
    "any.required": "message is required",
    "string.max": "Message cannot exceed 4096 characters",
  }),
  contextType: Joi.string()
    .valid("announcement", "car", "apartment", "feedback")
    .allow("", null),
  contextData: Joi.object().allow(null),
  parse_mode: Joi.string()
    .valid("HTML", "Markdown", "MarkdownV2")
    .default("HTML"),
});

/**
 * @swagger
 * /api/v1/telegram/send:
 *   post:
 *     summary: Send message to Telegram
 *     tags: [Telegram]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chat_id
 *               - message
 *             properties:
 *               chat_id:
 *                 type: string
 *               message:
 *                 type: string
 *               contextType:
 *                 type: string
 *                 enum: [announcement, car, apartment, feedback]
 *               contextData:
 *                 type: object
 *               parse_mode:
 *                 type: string
 *                 enum: [HTML, Markdown, MarkdownV2]
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
  async (req, res, next) => {
    try {
      // Validate input
      const validatedData = validate(sendMessageSchema, req.body);

      const {
        chat_id,
        message,
        contextType,
        contextData,
        parse_mode = "HTML",
      } = validatedData;

      // Get user_id from token (may be null for feedback)
      const user_id = req.user?.user_id;

      logger.info("Telegram send request", {
        contextType,
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

      // Build context message
      const finalMessage = telegramService.buildContextMessage({
        message,
        contextType,
        contextData,
        user_id,
        dbUsername,
      });

      // Send message
      const result = await telegramService.sendMessage({
        message: finalMessage,
        chatIds: [chat_id],
        parse_mode,
      });

      if (result.results[0].error) {
        throw new Error(result.results[0].error);
      }

      logger.info("Telegram message sent successfully", {
        chat_id,
        contextType,
      });

      res.json({
        success: true,
        result: result.results[0],
      });
    } catch (error) {
      logger.error("Error sending Telegram message", {
        error: error.message,
      });
      next(error);
    }
  }
);

export default router;
