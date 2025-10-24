import Joi from "joi";

/**
 * Validation schemas for House operations
 */

export const getEntrancesSchema = Joi.object({
  house: Joi.string().required(),
});

export const getHousesFilterSchema = Joi.object({
  house: Joi.string().optional(),
  entrance: Joi.number().integer().optional(),
  position: Joi.number().integer().optional(),
});

export const userIdParamSchema = Joi.object({
  id_telegram: Joi.number().integer().positive().required(),
});

export const houseIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const linkUserToApartmentSchema = Joi.object({
  house: Joi.string().required(),
  number: Joi.number().integer().required(),
  id_telegram: Joi.number().integer().positive().required(),
});

export const unlinkUserFromApartmentSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  id_telegram: Joi.number().integer().positive().required(),
});
