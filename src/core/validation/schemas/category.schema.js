import Joi from "joi";

/**
 * Validation schemas for Category operations
 */

export const getCategoryByIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const getSubcategoriesByCategoryIdSchema = Joi.object({
  category_id: Joi.number().integer().positive().required(),
});

export const getSubcategoryByIdSchema = Joi.object({
  category_id: Joi.number().integer().positive().required(),
  subcategory_id: Joi.number().integer().positive().required(),
});
