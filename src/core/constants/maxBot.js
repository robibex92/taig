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

/**
 * Курсоры long polling в таблице max_bot_state.
 *
 * `updates_marker` — общий курсор: по нему режем повторную доставку событий.
 * `chat_reply_marker` — максимальный marker среди событий, уже рассмотренных для
 * автоответа. Ключ отдельный, а не тот же `updates_marker`, из-за самого первого
 * запуска: курсора ещё нет, MAX отдаёт накопленный backlog чата, и бот не должен
 * отвечать на сообщения, появившиеся до его включения.
 */
export const MAX_BOT_STATE_KEYS = {
  UPDATES_MARKER: "updates_marker",
  CHAT_REPLY_MARKER: "chat_reply_marker",
};

/**
 * Сколько чатов реестра можно залить в одну отправку.
 *
 * Ограничик не косметический: отправка синхронная (админ ждёт ответ), а между
 * чатами пауза, поэтому десяток чатов — это секунды, а сотни — уже таймаут
 * запроса. Настраиваемым не делаем: за него отвечает список реестра.
 */
export const MAX_BOT_CHAT_RECIPIENTS = 50;

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

/**
 * id строк реестра `max_chats`, которые админ выбрал для отправки.
 *
 * Принимаются именно внутренние id записей, а не `chat_id` MAX: реестр —
 * единственный источник адресов, и подстановка чужого `chat_id` в запрос не
 * должна быть возможна даже теоретически. Дубли схлопываются, нечисловые
 * значения — ошибка.
 *
 * @returns {string[]} id в виде строк (BigInt-safe), в порядке выбора
 */
export const validateMaxBotChatIds = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError("Не выбран ни один чат");
  }

  const normalized = [];

  for (const item of ids) {
    const asNumber = Number(item);

    if (!Number.isInteger(asNumber) || asNumber <= 0) {
      throw new ValidationError(`Некорректный id чата: ${String(item)}`);
    }

    const asString = String(asNumber);

    if (!normalized.includes(asString)) {
      normalized.push(asString);
    }
  }

  if (normalized.length > MAX_BOT_CHAT_RECIPIENTS) {
    throw new ValidationError(
      `Слишком много чатов в одной отправке: ${normalized.length}, максимум ${MAX_BOT_CHAT_RECIPIENTS}`
    );
  }

  return normalized;
};

export default {
  MAX_BOT_TEXT_LIMIT,
  MAX_BOT_CHAT_RECIPIENTS,
  MAX_BOT_INBOX_DIRECTION,
  MAX_BOT_BROADCAST_STATUS,
  MAX_BOT_RECIPIENT_STATUS,
  MAX_BOT_STATE_KEYS,
  validateMaxBotText,
  validateMaxBotChatIds,
};
