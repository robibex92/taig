import express from "express";
import container from "../../infrastructure/container/Container.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import { GLOBAL_ROLES } from "../../core/utils/roles.js";
import {
  createMaxChatSchema,
  updateMaxChatSchema,
  maxChatIdParamSchema,
  maxChatLookupSchema,
  listMaxChatsQuerySchema,
} from "../../core/validation/schemas/maxChat.schema.js";

const router = express.Router();
const maxChatController = container.resolve("maxChatController");

/**
 * Реестр MAX-чатов.
 *
 * Читать может любой вошедший: список нужен форме публикации объявления.
 * Писать — только `global:admin`: чат, в который бот публикует объявления,
 * это настройка дома, а не пользовательский выбор.
 */
router.get(
  "/",
  authenticate,
  validateRequest(listMaxChatsQuerySchema, "query"),
  maxChatController.getChats
);

/**
 * Проверка чата по его id в MAX перед занесением в реестр.
 * Список своих чатов API боту не отдаёт, поэтому проверка — по одному id.
 */
router.get(
  "/lookup/:chatId",
  authenticate,
  authorize(GLOBAL_ROLES.ADMIN),
  validateRequest(maxChatLookupSchema, "params"),
  maxChatController.lookupChat
);

router.post(
  "/",
  authenticate,
  authorize(GLOBAL_ROLES.ADMIN),
  validateRequest(createMaxChatSchema, "body"),
  maxChatController.createChat
);

router.patch(
  "/:id",
  authenticate,
  authorize(GLOBAL_ROLES.ADMIN),
  validateRequest(maxChatIdParamSchema, "params"),
  validateRequest(updateMaxChatSchema, "body"),
  maxChatController.updateChat
);

router.delete(
  "/:id",
  authenticate,
  authorize(GLOBAL_ROLES.ADMIN),
  validateRequest(maxChatIdParamSchema, "params"),
  maxChatController.deleteChat
);

export default router;
