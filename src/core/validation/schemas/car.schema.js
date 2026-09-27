import Joi from "joi";

/**
 * Validation schemas for Car operations
 */

const positiveId = Joi.number().integer().positive().required();

/** Идентичность машины. Колонки в БД — TEXT, поэтому длины здесь — потолок разумного, а не схемы. */
const carIdentityFields = {
  user_id: Joi.number().integer().positive().allow(null),
  car_number: Joi.string(),
  car_model: Joi.string().allow(""),
  car_brand: Joi.string(),
  car_color: Joi.string(),
  info: Joi.any(),
  status: Joi.alternatives().try(Joi.boolean(), Joi.string()),
};

export const createCarSchema = Joi.object({
  ...carIdentityFields,
  car_number: carIdentityFields.car_number.required(),
  car_brand: carIdentityFields.car_brand.required(),
  car_color: carIdentityFields.car_color.required(),
});

/** Правка: любое подмножество полей — фронт шлёт `Partial<CreateCarDto>` и статус. */
export const updateCarSchema = Joi.object(carIdentityFields);

/**
 * Один и тот же положительный id в разных параметрах URL. Раньше для `:imageId`
 * и `:noteId` переиспользовался `carIdSchema`, то есть проверка читалась как
 * «это id машины», хотя машиной там и не пахло.
 */
export const carIdParamSchema = Joi.object({ id: positiveId });
export const imageIdParamSchema = Joi.object({ imageId: positiveId });
export const noteIdParamSchema = Joi.object({ noteId: positiveId });
export const userIdParamSchema = Joi.object({ user_id: positiveId });

/** Загрузка фото: либо файл (multer положит в `req.file`), либо ссылка. */
export const addCarImageSchema = Joi.object({
  image_url: Joi.string().allow("", null),
  comment: Joi.string().allow("", null).max(2000),
});

export const updateCarImageSchema = Joi.object({
  comment: Joi.string().allow("", null).max(2000),
});

export const carNoteSchema = Joi.object({
  note: Joi.string().trim().min(1).max(5000).required().messages({
    "any.required": "Текст заметки обязателен",
    "string.empty": "Текст заметки обязателен",
    "string.min": "Текст заметки обязателен",
    "string.max": "Заметка слишком длинная",
  }),
});

export const mergeCarsSchema = Joi.object({
  car_id_1: positiveId,
  car_id_2: positiveId,
  merge_options: Joi.object().allow(null),
}).messages({
  "any.required": "Нужны оба id машин",
});

export const assignCarSchema = Joi.object({ user_id: positiveId }).messages({
  "any.required": "Нужно указать пользователя",
});
