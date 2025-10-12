import Joi from "joi";

/**
 * Validation schemas for AdImage operations
 */

export const createAdImagesSchema = Joi.object({
  ad_id: Joi.number().integer().positive().optional(),
  post_id: Joi.number().integer().positive().optional(),
  images: Joi.array()
    .items(
      Joi.object({
        image_url: Joi.string().required(),
        is_main: Joi.boolean().optional().default(false),
      })
    )
    .min(1)
    .required(),
})
  .xor("ad_id", "post_id")
  .messages({
    "object.xor": "Either ad_id or post_id must be provided",
  });

export const getAdImagesSchema = Joi.object({
  ad_id: Joi.number().integer().positive().optional(),
  post_id: Joi.number().integer().positive().optional(),
})
  .xor("ad_id", "post_id")
  .messages({
    "object.xor": "Either ad_id or post_id must be provided",
  });

export const getImagesByIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const deleteImagesSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
});

export const setMainImageSchema = Joi.object({
  image_id: Joi.number().integer().positive().required(),
  ad_id: Joi.number().integer().positive().optional(),
  post_id: Joi.number().integer().positive().optional(),
})
  .xor("ad_id", "post_id")
  .messages({
    "object.xor": "Either ad_id or post_id must be provided",
  });

export const imageIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
