import Joi from "joi";
import {
  HOUSE_CELL_INDEX_MAX,
  HOUSE_CELL_SPAN_MAX,
  HOUSE_FLOOR_MAX,
  HOUSE_INFO_MAX_LENGTH,
} from "../../constants/index.js";

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

/**
 * `PATCH /nearby/:id/info` — текст информации о квартире (пустая строка очищает).
 */
export const updateHouseInfoSchema = Joi.object({
  info: Joi.string().trim().max(HOUSE_INFO_MAX_LENGTH).allow("").required().messages({
    "any.required": "Info is required",
    "string.empty": "Info is required",
    "string.max": `Info text cannot exceed ${HOUSE_INFO_MAX_LENGTH} characters`,
  }),
});

/**
 * `PATCH /nearby/:id/layout` — раскладка квартиры в сетке витрины.
 * `cellIndex: null` возвращает квартиру в автоматическую расстановку.
 */
export const apartmentLayoutSchema = Joi.object({
  floor: Joi.number().integer().min(1).max(HOUSE_FLOOR_MAX).optional().messages({
    "number.base": "Floor must be a number",
    "number.integer": "Floor must be a whole number",
    "number.min": "Floor must be at least 1",
    "number.max": `Floor cannot exceed ${HOUSE_FLOOR_MAX}`,
  }),
  cellIndex: Joi.number().integer().min(0).max(HOUSE_CELL_INDEX_MAX).allow(null).optional().messages({
    "number.base": "Cell index must be a number",
    "number.integer": "Cell index must be a whole number",
    "number.min": "Cell index starts at 0",
    "number.max": `Cell index cannot exceed ${HOUSE_CELL_INDEX_MAX}`,
  }),
  cellSpan: Joi.number().integer().min(1).max(HOUSE_CELL_SPAN_MAX).optional().messages({
    "number.base": "Cell span must be a number",
    "number.integer": "Cell span must be a whole number",
    "number.min": "Cell span must be at least 1",
    "number.max": `Cell span cannot exceed ${HOUSE_CELL_SPAN_MAX}`,
  }),
})
  .or("floor", "cellIndex", "cellSpan")
  .messages({
    "object.missing": "Нужно указать хотя бы один параметр раскладки",
  });
