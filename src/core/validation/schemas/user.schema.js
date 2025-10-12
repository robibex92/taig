import Joi from "joi";
import { USER_STATUS } from "../../constants/index.js";

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
  status: Joi.string().valid(...Object.values(USER_STATUS)),
}).min(1);
