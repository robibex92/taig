import Joi from "joi";

/**
 * Validation schemas for MAX authentication
 */

export const maxAuthSchema = Joi.object({
  max_id: Joi.number().integer().positive().required(),
  max_first_name: Joi.string().max(255).required(),
  max_last_name: Joi.string().max(255).allow(null, ""),
  max_photo_url: Joi.string().uri().allow(null, ""),
  max_platform: Joi.string().max(50).allow(null, ""),
  auth_key: Joi.string().required(),
  auth_date: Joi.number().integer().positive().required(),
  hash: Joi.string().required(),
});

export const linkMaxSchema = Joi.object({
  max_id: Joi.number().integer().positive().required(),
  max_first_name: Joi.string().max(255).required(),
  max_last_name: Joi.string().max(255).allow(null, ""),
  max_photo_url: Joi.string().uri().allow(null, ""),
  max_platform: Joi.string().max(50).allow(null, ""),
  auth_key: Joi.string().required(),
  auth_date: Joi.number().integer().positive().required(),
  hash: Joi.string().required(),
});

export const linkTelegramSchema = Joi.object({
  id_telegram: Joi.number().integer().positive().required(),
  first_name: Joi.string().max(255).required(),
  last_name: Joi.string().max(255).allow(null, ""),
  username: Joi.string().max(255).allow(null, ""),
  photo_url: Joi.string().uri().allow(null, ""),
  auth_date: Joi.number().integer().positive().required(),
  hash: Joi.string().required(),
});

export const unlinkPlatformSchema = Joi.object({
  platform: Joi.string().valid("telegram", "max").required(),
});

export const updatePlatformSettingsSchema = Joi.object({
  primary_platform: Joi.string().valid("telegram", "max").required(),
});
