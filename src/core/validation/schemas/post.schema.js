import Joi from "joi";

export const createPostSchema = Joi.object({
  title: Joi.string().min(3).max(255).trim().required().messages({
    "string.min": "Title must be at least 3 characters long",
    "string.max": "Title cannot exceed 255 characters",
    "any.required": "Title is required",
  }),

  content: Joi.string().min(10).max(5000).trim().required().messages({
    "string.min": "Content must be at least 10 characters long",
    "string.max": "Content cannot exceed 5000 characters",
    "any.required": "Content is required",
  }),

  image_url: Joi.string().uri().allow("", null),

  status: Joi.string().valid("active", "deleted").default("active"),

  source: Joi.string().trim().allow("", null),

  marker: Joi.string().trim().allow("", null),

  isImportant: Joi.boolean().default(false),

  selectedChats: Joi.array()
    .items(
      Joi.object({
        chatId: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
        threadId: Joi.alternatives()
          .try(Joi.number(), Joi.string())
          .allow(null),
      })
    )
    .default([]),

  photos: Joi.array().items(Joi.string().uri()).default([]),

  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        is_main: Joi.boolean().default(false),
      })
    )
    .default([]),
});

export const updatePostSchema = Joi.object({
  title: Joi.string().min(3).max(255).trim(),
  content: Joi.string().min(10).max(5000).trim(),
  image_url: Joi.string().uri().allow("", null),
  status: Joi.string().valid("active", "deleted"),
  source: Joi.string().trim().allow("", null),
  marker: Joi.string().trim().allow("", null),
}).min(1);

export const getPostsQuerySchema = Joi.object({
  status: Joi.string().valid("active", "deleted").default("active"),
});
