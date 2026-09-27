import Joi from "joi";
import { HOUSE_FLOOR_MAX, HOUSE_ROW_OFFSET_MAX } from "../../constants/index.js";

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
  floor: Joi.number().integer().min(1).max(HOUSE_FLOOR_MAX).required(),
  // `position` — ячейка начала ряда, отсчёт от 1 (1 = без отступа).
  position: Joi.number().integer().min(1).max(HOUSE_ROW_OFFSET_MAX).required(),
});

/**
 * `PATCH /floor-rules/offsets` — отступ ряда сразу для набора этажей подъезда.
 */
export const floorOffsetsSchema = Joi.object({
  house: Joi.string().required(),
  entrance: Joi.number().integer().positive().required(),
  floors: Joi.array()
    .items(Joi.number().integer().min(1).max(HOUSE_FLOOR_MAX).required())
    .min(1)
    .max(60)
    .unique()
    .required(),
  position: Joi.number().integer().min(1).max(HOUSE_ROW_OFFSET_MAX).required(),
});
