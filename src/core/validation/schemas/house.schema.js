import Joi from "joi";

/**
 * Validation schemas for House operations
 */

export const getEntrancesSchema = Joi.object({
  house: Joi.string().required(),
});

export const getHousesFilterSchema = Joi.object({
  // `.empty("")` — иначе `?house=&entrance=` из формы считается ошибкой, хотя
  // раньше такие пустые значения просто считались «не задано».
  house: Joi.string().trim().empty("").optional(),
  entrance: Joi.number().integer().empty("").optional(),
  position: Joi.number().integer().empty("").optional(),
});

export const userIdParamSchema = Joi.object({
  id_telegram: Joi.number().integer().positive().required(),
});

export const houseIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const commentText = Joi.string().trim().min(1).max(1000).required().messages({
  "any.required": "Comment text is required",
  "string.empty": "Comment text is required",
  "string.min": "Comment text is required",
  "string.max": "Comment cannot exceed 1000 characters",
});

const houseNumber = (label) =>
  Joi.string().trim().empty("").required().messages({
    "any.required": `${label} is required`,
    "string.empty": `${label} is required`,
  });

/** Тело комментария дома или подъезда: только текст. */
export const houseCommentBodySchema = Joi.object({ comment: commentText });

/** Тот же комментарий, но дом задаётся номером в теле запроса. */
export const houseCommentByNumberSchema = Joi.object({
  house: houseNumber("House number"),
  comment: commentText,
});

/** `?house=…` в упрощённых эндпоинтах комментария. */
export const houseCommentQuerySchema = Joi.object({
  house: houseNumber("House number"),
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
