import Joi from "joi";
import { AD_STATUS } from "../../constants/index.js";

export const createAdSchema = Joi.object({
  user_id: Joi.number().integer().positive().required().messages({
    "number.base": "User ID must be a number",
    "number.integer": "User ID must be an integer",
    "number.positive": "User ID must be positive",
    "any.required": "User ID is required",
  }),

  title: Joi.string().min(3).max(200).trim().required().messages({
    "string.min": "Title must be at least 3 characters long",
    "string.max": "Title cannot exceed 200 characters",
    "any.required": "Title is required",
  }),

  content: Joi.string().min(10).max(5000).trim().required().messages({
    "string.min": "Content must be at least 10 characters long",
    "string.max": "Content cannot exceed 5000 characters",
    "any.required": "Content is required",
  }),

  category: Joi.number().integer().positive().required().messages({
    "number.base": "Category must be a number",
    "number.integer": "Category must be an integer",
    "number.positive": "Category must be positive",
    "any.required": "Category is required",
  }),

  subcategory: Joi.number().integer().positive().allow(null).messages({
    "number.base": "Subcategory must be a number",
    "number.integer": "Subcategory must be an integer",
    "number.positive": "Subcategory must be positive",
  }),

  price: Joi.alternatives()
    .try(Joi.number().positive(), Joi.string().trim())
    .allow("", null),

  status: Joi.string()
    .valid(...Object.values(AD_STATUS))
    .default(AD_STATUS.ACTIVE),

  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        is_main: Joi.boolean().default(false),
      })
    )
    .max(10)
    .default([]),

  isTelegram: Joi.boolean().default(false),

  selectedChats: Joi.array()
    .items(Joi.number().integer().positive())
    .default([]),
});

export const updateAdSchema = Joi.object({
  title: Joi.string().min(3).max(200).trim().optional(),
  content: Joi.string().min(10).max(5000).trim().optional(),
  category: Joi.number().integer().positive().optional(),
  subcategory: Joi.number().integer().positive().allow(null).optional(),
  price: Joi.alternatives()
    .try(Joi.number().positive(), Joi.string().trim())
    .allow("", null)
    .optional(),
  status: Joi.string().valid(...Object.values(AD_STATUS)).optional(),
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        is_main: Joi.boolean().default(false),
      })
    )
    .max(10)
    .optional(),
  isTelegram: Joi.boolean().optional(),
  selectedChats: Joi.array()
    .items(Joi.number().integer().positive())
    .optional(),
  telegramUpdateType: Joi.string()
    .valid("update_text", "update_media", "delete_and_repost")
    .optional(),
});

export const getAdsQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(AD_STATUS))
    .default(AD_STATUS.ACTIVE),
  category: Joi.number().integer().positive(),
  subcategory: Joi.number().integer().positive(),
  sort: Joi.string()
    .valid("created_at", "price", "updated_at")
    .default("created_at"),
  order: Joi.string().valid("ASC", "DESC").default("DESC"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  // Price filters
  priceMin: Joi.number().min(0),
  priceMax: Joi.number().min(0),
  // Date filters
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
  // Search
  search: Joi.string().trim().max(200),
});
