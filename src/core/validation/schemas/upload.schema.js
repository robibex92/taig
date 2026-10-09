import Joi from "joi";

/**
 * Validation schemas for upload operations
 */

export const sweepUploadsQuerySchema = Joi.object({
  // Файл, пролежавший меньше столько часов, не убирается: человек мог выбрать
  // фото и не дослать объявление.
  older_than_hours: Joi.number().integer().min(1).max(8760).default(48),
  // Прогон без удаления — по умолчанию: список уборки смотрят до разрушающего шага.
  dry_run: Joi.boolean().default(true),
});
