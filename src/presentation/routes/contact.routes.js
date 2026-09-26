import express from "express";
import Joi from "joi";
import container from "../../infrastructure/container/Container.js";
import { authenticateConditional, authenticateJWT } from "../middlewares/authMiddleware.js";
import { contactMessageLimiter } from "../middlewares/securityMiddleware.js";
import { validate } from "../../core/validation/validator.js";
import { prisma } from "../../infrastructure/database/db.js";
import { ContactController } from "../controllers/ContactController.js";

/**
 * Личные сообщения между жителями: «написать владельцу/соседу».
 *
 * Замена прямому `POST /telegram/send` с `chat_id` из клиента: адресат —
 * человек, а канал и id выбирает бэк (MessageDeliveryService).
 */

const router = express.Router();

const contactController = new ContactController({
  delivery: container.resolve("messageDeliveryService"),
  telegramService: container.resolve("telegramService"),
  db: prisma,
});

const idSchema = Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/));

const sendSchema = Joi.object({
  user_id: idSchema,
  id_telegram: idSchema,
  message: Joi.string().min(1).max(4096).required().messages({
    "string.empty": "Текст сообщения обязателен",
    "string.max": "Сообщение слишком длинное",
  }),
  contextType: Joi.string()
    .valid("announcement", "car", "apartment", "parking")
    .allow("", null),
  contextData: Joi.object().allow(null),
  channel: Joi.string().valid("telegram", "max", "auto").default("auto"),
}).or("user_id", "id_telegram");

const availabilitySchema = Joi.object({
  user_id: idSchema,
  id_telegram: idSchema,
}).or("user_id", "id_telegram");

/**
 * @swagger
 * /api-v1/contacts/availability:
 *   get:
 *     summary: Which messengers the recipient has (flags only, no ids)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: id_telegram
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: { found, telegram, max }
 */
router.get(
  "/contacts/availability",
  authenticateJWT,
  (req, res, next) => {
    req.query = validate(availabilitySchema, req.query);
    next();
  },
  contactController.availability
);

/**
 * @swagger
 * /api-v1/contacts/send:
 *   post:
 *     summary: Send a personal message to a resident via Telegram or MAX
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delivered
 *       404:
 *         description: Recipient not found
 *       409:
 *         description: No channel / channel unavailable / no dialog with the bot
 */
router.post(
  "/contacts/send",
  authenticateConditional,
  contactMessageLimiter,
  (req, res, next) => {
    req.body = validate(sendSchema, req.body);
    next();
  },
  contactController.send
);

export default router;
