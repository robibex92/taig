import { ValidationError } from "../errors/AppError.js";

/**
 * Константы модуля «MAX-бот» (админка).
 * Значения совпадают с CHECK-ограничениями миграции
 * `prisma/migrations/add_max_bot_tables.sql`.
 */

export const MAX_BOT_TEXT_LIMIT = 4000;

export const MAX_BOT_INBOX_DIRECTION = {
  IN: "in",
  OUT: "out",
};

export const MAX_BOT_BROADCAST_STATUS = {
  DRAFT: "draft",
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
};

export const MAX_BOT_BROADCAST_ACTIVE_STATUSES = [
  MAX_BOT_BROADCAST_STATUS.QUEUED,
  MAX_BOT_BROADCAST_STATUS.RUNNING,
];

export const MAX_BOT_RECIPIENT_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
};

/** Курсор long polling в таблице max_bot_state. */
export const MAX_BOT_STATE_KEYS = {
  UPDATES_MARKER: "updates_marker",
};

/**
 * Текст сообщения бота: непустой и не длиннее лимита MAX API.
 * @returns {string} нормализованный текст
 */
export const validateMaxBotText = (text) => {
  const value = typeof text === "string" ? text.trim() : "";

  if (!value) {
    throw new ValidationError("Сообщение не может быть пустым");
  }
  if (value.length > MAX_BOT_TEXT_LIMIT) {
    throw new ValidationError(
      `Слишком длинное сообщение: ${value.length} символов, максимум ${MAX_BOT_TEXT_LIMIT}`
    );
  }

  return value;
};

export default {
  MAX_BOT_TEXT_LIMIT,
  MAX_BOT_INBOX_DIRECTION,
  MAX_BOT_BROADCAST_STATUS,
  MAX_BOT_RECIPIENT_STATUS,
  MAX_BOT_STATE_KEYS,
  validateMaxBotText,
};
