import Joi from "joi";

export const telegramAuthSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "any.required": "Telegram ID is required",
  }),

  username: Joi.string().trim().allow("", null),

  first_name: Joi.string().trim().required().messages({
    "any.required": "First name is required",
  }),

  last_name: Joi.string().trim().allow("", null),

  photo_url: Joi.string().uri().allow("", null),

  auth_date: Joi.number().integer().required(),

  hash: Joi.string().required(),
});

export const updateUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50),
  first_name: Joi.string().trim().min(1).max(100),
  last_name: Joi.string().trim().min(1).max(100).allow("", null),
  avatar: Joi.string().uri().allow("", null),
  telegram_first_name: Joi.string().trim().min(1).max(100),
  telegram_last_name: Joi.string().trim().min(1).max(100).allow("", null),
  is_manually_updated: Joi.boolean(),
  roles: Joi.array().items(Joi.string()),
}).min(1);

/**
 * Фильтры каталога жителей. Строку поиска в query-параметре быть не может:
 * там имя, телефон или ник, а URL оседает в access.log nginx и в истории
 * браузера администратора. Поэтому поиск — тело POST-запроса.
 */
export const adminUserSearchSchema = Joi.object({
  search: Joi.string().trim().max(100).allow("", null),
  role: Joi.string().trim().max(60).allow("", null),
  limit: Joi.number().integer().min(1).max(500).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

/**
 * `/users/:id` и `/users/:id/avatar`. Число обязательное: `Number('abc')` даёт
 * NaN, а Prisma на нём падает пятой сотой ошибкой вместо «человека нет».
 */
export const publicUserIdSchema = Joi.object({
  id: Joi.string()
    .pattern(/^\d+$/)
    .required()
    .messages({
      "any.required": "Требуется id пользователя",
      "string.pattern.base": "id пользователя должен быть числом",
    }),
});
