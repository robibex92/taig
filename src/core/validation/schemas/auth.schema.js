import Joi from "joi";

/**
 * Telegram authentication schema
 */
export const telegramAuthSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    "any.required": "Telegram ID is required",
    "number.base": "Telegram ID must be a number",
    "number.positive": "Telegram ID must be positive",
  }),

  username: Joi.string().trim().allow("", null).messages({
    "string.base": "Username must be a string",
  }),

  first_name: Joi.string().trim().required().messages({
    "any.required": "First name is required",
    "string.empty": "First name cannot be empty",
  }),

  last_name: Joi.string().trim().allow("", null).messages({
    "string.base": "Last name must be a string",
  }),

  photo_url: Joi.string().uri().allow("", null).messages({
    "string.uri": "Photo URL must be a valid URI",
  }),

  auth_date: Joi.number().integer().required().messages({
    "any.required": "Auth date is required",
    "number.base": "Auth date must be a number",
  }),

  hash: Joi.string().required().messages({
    "any.required": "Hash is required",
    "string.empty": "Hash cannot be empty",
  }),

  remember_me: Joi.boolean().default(false).messages({
    "boolean.base": "Remember me must be a boolean",
  }),
});

/**
 * Refresh token schema
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required().messages({
    "any.required": "Refresh token is required",
    "string.empty": "Refresh token cannot be empty",
  }),
});

/**
 * Session ID schema
 */
export const sessionIdSchema = Joi.object({
  sessionId: Joi.string().uuid().required().messages({
    "any.required": "Session ID is required",
    "string.guid": "Session ID must be a valid UUID",
  }),
});
