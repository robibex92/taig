import Joi from "joi";

/**
 * Validation schemas for FAQ operations
 */

export const getFaqsSchema = Joi.object({
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
});

export const createFaqSchema = Joi.object({
  question: Joi.string().min(3).max(500).required(),
  answer: Joi.string().min(3).max(5000).required(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
});

export const updateFaqSchema = Joi.object({
  question: Joi.string().min(3).max(500).optional(),
  answer: Joi.string().min(3).max(5000).optional(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
}).min(1); // At least one field required

export const faqIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
