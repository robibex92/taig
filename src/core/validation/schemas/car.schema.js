import Joi from "joi";

/**
 * Validation schemas for Car operations
 */

export const createCarSchema = Joi.object({
  user_id: Joi.number().integer().positive().allow(null).optional(),
  car_number: Joi.string().required(),
  car_model: Joi.string().required(),
  car_brand: Joi.string().required(),
  car_color: Joi.string().required(),
  info: Joi.any().optional(),
});

export const getUserIdSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
});

export const carIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
