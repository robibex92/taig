import Joi from "joi";

/**
 * Реестр MAX-чатов.
 *
 * `chat_id` — идентификатор чата в MAX (int64). Принимаем и числом, и строкой:
 * фронт отдаёт строку из JSON, а репозиторий превращает его в BigInt.
 */
const CHAT_PURPOSES = ["ads", "news", "general", "notifications"];
const CHAT_TYPES = ["CHAT", "CHANNEL", "DIALOG"];

const shape = {
  chat_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().pattern(/^\d{1,19}$/))
    .messages({
      "alternatives.types": "chat_id должен быть числом",
      "string.pattern.base": "chat_id должен быть числом",
    }),
  name: Joi.string().trim().max(255),
  description: Joi.string().trim().max(2000).allow("", null),
  chat_type: Joi.string().trim().uppercase().valid(...CHAT_TYPES),
  purpose: Joi.string().trim().lowercase().valid(...CHAT_PURPOSES),
  is_active: Joi.boolean(),
  visible_to_all: Joi.boolean(),
};

export const maxChatIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^\d{1,19}$/)
    .required()
    .messages({
      "string.pattern.base": "id записи о чате должен быть числом",
      "any.required": "Не указан id чата",
    }),
});

export const createMaxChatSchema = Joi.object({
  ...shape,
  chat_id: shape.chat_id.clone().required().messages({
    "any.required": "Не указан chat_id чата MAX",
  }),
  name: shape.name.clone().required().messages({
    "any.required": "Название чата обязательно",
    "string.empty": "Название чата не может быть пустым",
  }),
});

export const updateMaxChatSchema = Joi.object(shape).min(1).messages({
  "object.min": "Не указано ни одного поля для изменения",
});

/** `GET /max-chats/lookup/:chatId` — id чата в MAX, не id записи реестра. */
export const maxChatLookupSchema = Joi.object({
  chatId: Joi.string()
    .pattern(/^\d{1,19}$/)
    .required()
    .messages({
      "string.pattern.base": "chat_id должен быть числом",
      "any.required": "Не указан chat_id чата",
    }),
});

/**
 * `visible_to_all_only=true` — скрытые чаты не должны даже приходить в ответе
 * обычному пользователю: фильтр серверный, а не «фронт сам не покажет».
 */
export const listMaxChatsQuerySchema = Joi.object({
  purpose: Joi.string().trim().lowercase().valid(...CHAT_PURPOSES),
  active_only: Joi.string().valid("true", "false"),
  visible_to_all_only: Joi.string().valid("true", "false"),
});
