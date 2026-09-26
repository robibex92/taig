import Joi from "joi";
import { PARKING_STATUS_VALUES } from "../../constants/parking.js";

/**
 * Validation schemas for parking operations.
 *
 * До этого схема входа отсутствовала вовсе: проверки были размазаны по
 * контроллеру (`if (!content)`) и use-case (`if (!spotNumber)`), а допустимые
 * статусы жили только в swagger-комментарии.
 */

const price = Joi.alternatives().try(
  Joi.string().allow("").max(100),
  Joi.number()
);

const spotStatus = Joi.string()
  .valid(...PARKING_STATUS_VALUES)
  .messages({ "any.only": "Недопустимый статус парковочного места" });

export const createParkingSpotSchema = Joi.object({
  spotNumber: Joi.string().trim().max(10).required().messages({
    "any.required": "Номер парковочного места обязателен",
    "string.empty": "Номер парковочного места обязателен",
    "string.max": "Номер места слишком длинный",
  }),
  section: Joi.string().allow("", null).max(50),
  status: spotStatus,
  price: price.allow(null),
  description: Joi.string().allow("", null).max(5000),
  contactInfo: Joi.string().allow("", null).max(500),
  ownerId: Joi.number().integer().positive().allow(null),
});

// Номер, этаж и секция места не меняются: только состояние и данные жителя.
export const updateParkingSpotSchema = Joi.object({
  status: spotStatus,
  price: price.allow(null),
  description: Joi.string().allow("", null).max(5000),
  contactInfo: Joi.string().allow("", null).max(500),
});

export const assignOwnerSchema = Joi.object({
  ownerId: Joi.number().integer().positive().required().messages({
    "any.required": "Нужно указать владельца места",
  }),
});

export const parkingNoteSchema = Joi.object({
  note: Joi.string().trim().min(1).max(2000).required().messages({
    "any.required": "Текст заметки обязателен",
    "string.empty": "Текст заметки обязателен",
    "string.min": "Текст заметки обязателен",
    "string.max": "Заметка слишком длинная",
  }),
});

export const parkingMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(4096).required().messages({
    "any.required": "Текст сообщения обязателен",
    "string.empty": "Текст сообщения обязателен",
    "string.min": "Текст сообщения обязателен",
    "string.max": "Сообщение слишком длинное",
  }),
});
