import Joi from "joi";

/**
 * Validation schemas for FloorRule operations
 */

export const getFloorRulesSchema = Joi.object({
  house: Joi.string().required(),
  entrance: Joi.number().integer().positive().required(),
});

export const upsertFloorRuleSchema = Joi.object({
  house: Joi.string().required(),
  entrance: Joi.number().integer().positive().required(),
  floor: Joi.number().integer().positive().required(),
  position: Joi.number().integer().positive().required(),
});
