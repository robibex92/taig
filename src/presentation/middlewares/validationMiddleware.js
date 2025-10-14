import Joi from "joi";
import { ValidationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Validation Middleware using Joi
 * Validates request body, query params, and path params
 */

/**
 * Generic validation middleware
 * @param {Object} schema - Joi schema object with body, query, params
 */
export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const validationOptions = {
        abortEarly: false, // Return all errors
        stripUnknown: true, // Remove unknown fields
        errors: {
          wrap: {
            label: "", // Remove quotes from error messages
          },
        },
      };

      // Validate body
      if (schema.body) {
        const { error, value } = schema.body.validate(
          req.body,
          validationOptions
        );
        if (error) {
          throw new ValidationError(formatJoiError(error));
        }
        req.body = value;
      }

      // Validate query params
      if (schema.query) {
        const { error, value } = schema.query.validate(
          req.query,
          validationOptions
        );
        if (error) {
          throw new ValidationError(formatJoiError(error));
        }
        req.query = value;
      }

      // Validate path params
      if (schema.params) {
        const { error, value } = schema.params.validate(
          req.params,
          validationOptions
        );
        if (error) {
          throw new ValidationError(formatJoiError(error));
        }
        req.params = value;
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: "VALIDATION_ERROR",
        });
      }
      next(error);
    }
  };
};

/**
 * Format Joi error messages
 */
function formatJoiError(error) {
  return error.details.map((detail) => detail.message).join(", ");
}

// ============================================
// Common Validation Schemas
// ============================================

/**
 * Ad Schemas
 */
export const adSchemas = {
  create: {
    body: Joi.object({
      user_id: Joi.number().integer().positive().required(),
      title: Joi.string().min(3).max(255).trim().required().messages({
        "string.min": "Title must be at least 3 characters",
        "string.max": "Title must not exceed 255 characters",
        "any.required": "Title is required",
      }),
      content: Joi.string().min(10).max(5000).trim().required().messages({
        "string.min": "Content must be at least 10 characters",
        "string.max": "Content must not exceed 5000 characters",
      }),
      category: Joi.number().integer().positive().required(),
      subcategory: Joi.number().integer().positive().optional().allow(null),
      price: Joi.string().max(50).optional().allow(null, ""),
      status: Joi.string()
        .valid("active", "archive", "deleted")
        .default("active"),
      selectedChatIds: Joi.array()
        .items(Joi.alternatives().try(Joi.number(), Joi.string()))
        .optional(),
    }),
  },

  update: {
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
    }),
    body: Joi.object({
      title: Joi.string().min(3).max(255).trim().optional(),
      content: Joi.string().min(10).max(5000).trim().optional(),
      category: Joi.number().integer().positive().optional(),
      subcategory: Joi.number().integer().positive().optional().allow(null),
      price: Joi.string().max(50).optional().allow(null, ""),
      status: Joi.string().valid("active", "archive", "deleted").optional(),
    }).min(1), // At least one field must be provided
  },

  getById: {
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
    }),
  },

  getAll: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid("active", "archive", "deleted").optional(),
      category: Joi.number().integer().positive().optional(),
      subcategory: Joi.number().integer().positive().optional(),
      priceMin: Joi.number().min(0).optional(),
      priceMax: Joi.number().min(0).optional(),
      dateFrom: Joi.date().iso().optional(),
      dateTo: Joi.date().iso().optional(),
      search: Joi.string().max(255).trim().optional(),
      sort: Joi.string()
        .valid("created_at", "price", "view_count")
        .default("created_at"),
      order: Joi.string().valid("asc", "desc").default("desc"),
    }),
  },
};

/**
 * Booking Schemas
 */
export const bookingSchemas = {
  create: {
    params: Joi.object({
      adId: Joi.number().integer().positive().required(),
    }),
    body: Joi.object({
      // Additional fields can be added here
    }).optional(),
  },

  cancel: {
    params: Joi.object({
      bookingId: Joi.number().integer().positive().required(),
    }),
  },

  getByAd: {
    params: Joi.object({
      adId: Joi.number().integer().positive().required(),
    }),
    query: Joi.object({
      status: Joi.string().valid("active", "cancelled").default("active"),
    }),
  },
};

/**
 * User Schemas
 */
export const userSchemas = {
  update: {
    body: Joi.object({
      username: Joi.string().min(3).max(100).trim().optional(),
      first_name: Joi.string().max(100).trim().optional(),
      last_name: Joi.string().max(100).trim().optional(),
      avatar: Joi.string().uri().optional().allow(null, ""),
    }).min(1),
  },

  updateRole: {
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
    }),
    body: Joi.object({
      role: Joi.string()
        .valid("user", "admin", "moderator", "banned")
        .required(),
    }),
  },
};

/**
 * Comment Schemas
 */
export const commentSchemas = {
  create: {
    body: Joi.object({
      ad_id: Joi.number().integer().positive().required(),
      parent_id: Joi.number().integer().positive().optional().allow(null),
      content: Joi.string().min(1).max(2000).trim().required().messages({
        "string.min": "Comment cannot be empty",
        "string.max": "Comment must not exceed 2000 characters",
      }),
    }),
  },

  update: {
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
    }),
    body: Joi.object({
      content: Joi.string().min(1).max(2000).trim().required(),
    }),
  },

  delete: {
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
    }),
  },
};

/**
 * Post/News Schemas
 */
export const postSchemas = {
  create: {
    body: Joi.object({
      title: Joi.string().min(3).max(255).trim().required(),
      content: Joi.string().min(10).max(10000).trim().required(),
      image_url: Joi.string().uri().optional().allow(null, ""),
      status: Joi.string().valid("active", "deleted").default("active"),
      marker: Joi.string().max(100).optional().allow(null, ""),
      selectedChatIds: Joi.array()
        .items(Joi.alternatives().try(Joi.number(), Joi.string()))
        .optional(),
    }),
  },

  update: {
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
    }),
    body: Joi.object({
      title: Joi.string().min(3).max(255).trim().optional(),
      content: Joi.string().min(10).max(10000).trim().optional(),
      image_url: Joi.string().uri().optional().allow(null, ""),
      status: Joi.string().valid("active", "deleted").optional(),
      marker: Joi.string().max(100).optional().allow(null, ""),
    }).min(1),
  },
};

/**
 * Message Schemas
 */
export const messageSchemas = {
  send: {
    body: Joi.object({
      receiver_id: Joi.number().integer().positive().required(),
      ad_id: Joi.number().integer().positive().optional().allow(null),
      content: Joi.string().min(1).max(5000).trim().required().messages({
        "string.min": "Message cannot be empty",
        "string.max": "Message must not exceed 5000 characters",
      }),
    }),
  },
};

/**
 * FAQ Schemas
 */
export const faqSchemas = {
  update: {
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
    }),
    body: Joi.object({
      question: Joi.string().min(5).max(500).trim().optional(),
      answer: Joi.string().min(5).max(5000).trim().optional(),
      status: Joi.string().valid("active", "deleted").optional(),
    }).min(1),
  },
};

/**
 * Sanitize string (remove dangerous characters)
 * Basic XSS prevention
 */
export const sanitizeString = (str) => {
  if (typeof str !== "string") return str;

  return str
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
};

/**
 * Custom Joi extensions with sanitization
 */
export const sanitizedString = Joi.string().custom((value, helpers) => {
  return sanitizeString(value);
}, "XSS sanitization");

export default validate;
