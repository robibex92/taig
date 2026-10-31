import { logger } from "../../../core/utils/logger.js";
import { ValidationError, NotFoundError } from "../../../core/errors/AppError.js";
import defaultAutoReplyRepository from "../../../infrastructure/repositories/ChatAutoReplyRepository.js";
import defaultReminderRepository from "../../../infrastructure/repositories/ChatReminderRepository.js";
import { TelegramChatRepository } from "../../../infrastructure/repositories/TelegramChatRepository.js";
import defaultMaxChats from "../../../infrastructure/repositories/MaxChatRepository.js";
import chatAutoReplyService from "../../services/ChatAutoReplyService.js";
import {
  CHAT_BOT_PLATFORMS,
  CHAT_TRIGGER_RESPONSE_LIMIT,
  validateAutoReplyInput,
} from "../../../core/utils/chatAutoReply.js";
import {
  describeReminderSchedule,
  nextOccurrence,
  reminderTimeZone,
  validateReminderSchedule,
} from "../../../core/utils/chatReminderSchedule.js";

/** `TelegramChatRepository` — без singleton-экспорта, поэтому экземпляр свой. */
const defaultTelegramChats = new TelegramChatRepository();

/**
 * Настройки «дежурного бота» в админке: условия автоответа и напоминания.
 *
 * Оба раздела работают по одному принципу: адрес чата админ выбирает из
 * реестра (Telegram-чаты / MAX-чаты), а не вписывает id руками. Поэтому
 * напоминание можно направить только в тот чат, который уже заведён и включён,
 * — и в список он попадает вместе с названием, а не как набор цифр.
 */

const validatePlatform = (platform) => {
  const value = String(platform ?? "").trim();

  if (!CHAT_BOT_PLATFORMS.includes(value)) {
    throw new ValidationError(`Неизвестный канал: ${value || "—"}`);
  }

  return value;
};

const toId = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError("Некорректный id записи");
  }

  return parsed;
};

const serializeAutoReply = (row) => ({
  id: String(row.id),
  platform: row.platform,
  phrase: row.phrase,
  response: row.response,
  is_active: row.is_active,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const serializeReminder = (row) => ({
  id: String(row.id),
  platform: row.platform,
  chat_record_id: String(row.chat_record_id),
  text: row.text,
  schedule_kind: row.schedule_kind,
  time_of_day: row.time_of_day,
  weekdays: row.weekdays,
  day_of_month: row.day_of_month,
  last_day_of_month: row.last_day_of_month,
  is_active: row.is_active,
  last_occurrence_key: row.last_occurrence_key,
  last_result: row.last_result,
  last_error: row.last_error,
  last_sent_at: row.last_sent_at,
  failed_attempts: row.failed_attempts,
  schedule_description: describeReminderSchedule(row),
});

/** Нормализованное расписание -> поля репозитория (одна форма для create и update). */
const mapSchedule = (schedule) => ({
  scheduleKind: schedule.schedule_kind,
  timeOfDay: schedule.time_of_day,
  weekdays: schedule.weekdays,
  dayOfMonth: schedule.day_of_month,
  lastDayOfMonth: schedule.last_day_of_month,
});

export class ChatBotAdminUseCases {
  constructor({
    autoReplyRepository = defaultAutoReplyRepository,
    reminderRepository = defaultReminderRepository,
    telegramChats = defaultTelegramChats,
    maxChats = defaultMaxChats,
    autoReplyService = chatAutoReplyService,
    loggerImpl,
  } = {}) {
    this.autoReplies = autoReplyRepository;
    this.reminders = reminderRepository;
    this.telegramChats = telegramChats;
    this.maxChats = maxChats;
    this.service = autoReplyService;
    this.log = loggerImpl ?? logger;
  }

  // ---------- условия автоответа ----------

  async listAutoReplies({ platform = null } = {}) {
    const rows = await this.autoReplies.list({ platform: platform ? validatePlatform(platform) : null });

    return rows.map(serializeAutoReply);
  }

  async createAutoReply({ platform, phrase, response, isActive }) {
    const channel = validatePlatform(platform);
    const normalized = validateAutoReplyInput({ phrase, response });

    const duplicate = await this.autoReplies.findByPhrase(channel, normalized.phrase);

    if (duplicate) {
      throw new ValidationError(`Такое условие для ${channel} уже есть (id ${duplicate.id})`);
    }

    const created = await this.autoReplies.create({
      platform: channel,
      ...normalized,
      isActive: isActive !== false,
    });

    // Кэш движка живёт несколько секунд, но после правки ждать нельзя: админ
    // хочет, чтобы новое условие действовало со следующего сообщения.
    this.service.invalidate(channel);
    this.log.info("Чат-боты: условие автоответа создано", {
      platform: channel,
      trigger_id: String(created.id),
    });

    return serializeAutoReply(created);
  }

  async updateAutoReply({ id, phrase, response, isActive }) {
    const existing = await this.autoReplies.getById(toId(id));

    if (!existing) throw new NotFoundError("Условие не найдено");

    const patch = {};

    if (phrase !== undefined || response !== undefined) {
      const normalized = validateAutoReplyInput({
        phrase: phrase ?? existing.phrase,
        response: response ?? existing.response,
      });

      if (normalized.phrase !== existing.phrase) {
        const duplicate = await this.autoReplies.findByPhrase(existing.platform, normalized.phrase);

        if (duplicate && String(duplicate.id) !== String(existing.id)) {
          throw new ValidationError("Условие с такой фразой уже есть");
        }
      }

      patch.phrase = normalized.phrase;
      patch.response = normalized.response;
    }

    if (isActive !== undefined) patch.isActive = isActive === true || isActive === "true";

    const updated = await this.autoReplies.update(existing.id, patch);

    this.service.invalidate(existing.platform);

    return serializeAutoReply(updated);
  }

  async deleteAutoReply({ id }) {
    const existing = await this.autoReplies.getById(toId(id));

    if (!existing) throw new NotFoundError("Условие не найдено");

    await this.autoReplies.delete(existing.id);
    this.service.invalidate(existing.platform);
    this.log.info("Чат-боты: условие автоответа удалено", {
      platform: existing.platform,
      trigger_id: String(existing.id),
    });

    return { deleted: String(existing.id) };
  }

  // ---------- напоминания ----------

  /**
   * Реестр — источник адреса. Возвращает строку чата или бросает внятную ошибку:
   * «такого чата нет» и «чат выключен» для админа означают разное.
   */
  async resolveChat(platform, chatRecordId) {
    const id = toId(chatRecordId);

    if (platform === "telegram") {
      const chat = await this.telegramChats.getById(id);

      if (!chat) throw new NotFoundError("Чат Telegram не найден в реестре");
      if (!chat.is_active) throw new ValidationError(`Чат «${chat.name}» выключен`);

      return { chat_id: String(chat.chat_id), thread_id: chat.thread_id ?? null, name: chat.name };
    }

    const chat = await this.maxChats.getById(id);

    if (!chat) throw new NotFoundError("Чат MAX не найден в реестре");
    if (!chat.is_active) throw new ValidationError(`Чат «${chat.name}» выключен`);

    return { chat_id: String(chat.chat_id), thread_id: null, name: chat.name };
  }

  async listReminders({ platform = null } = {}) {
    const rows = await this.reminders.list({ platform: platform ? validatePlatform(platform) : null });

    return rows.map(serializeReminder);
  }

  /** Предпросмотр расписания: когда сработает в следующий раз. */
  previewReminder({ scheduleKind, timeOfDay, weekdays, dayOfMonth, lastDayOfMonth }) {
    const schedule = validateReminderSchedule({
      scheduleKind,
      timeOfDay,
      weekdays,
      dayOfMonth,
      lastDayOfMonth,
    });

    const next = nextOccurrence(schedule, new Date());

    return {
      timezone: reminderTimeZone(),
      schedule_description: describeReminderSchedule(schedule),
      next_occurrence: next,
    };
  }

  async createReminder(input) {
    const platform = validatePlatform(input.platform);
    const chat = await this.resolveChat(platform, input.chatRecordId);
    const schedule = validateReminderSchedule(input);
    const text = String(input.text ?? "").trim();

    if (!text) throw new ValidationError("Пустой текст напоминания");

    if (text.length > CHAT_TRIGGER_RESPONSE_LIMIT) {
      throw new ValidationError(
        `Напоминание длиннее ${CHAT_TRIGGER_RESPONSE_LIMIT} символов`
      );
    }

    const created = await this.reminders.create({
      platform,
      chatRecordId: toId(input.chatRecordId),
      text,
      isActive: input.isActive !== false,
      ...mapSchedule(schedule),
    });

    this.log.info("Чат-боты: напоминание создано", {
      platform,
      reminder_id: String(created.id),
      chat: chat.name,
      schedule: schedule.schedule_kind,
    });

    return serializeReminder(created);
  }

  async updateReminder({ id, ...patch }) {
    const existing = await this.reminders.getById(toId(id));

    if (!existing) throw new NotFoundError("Напоминание не найдено");

    const update = {};

    if (patch.chatRecordId !== undefined) {
      // Результат резолва здесь не нужен — важен сам факт: чат есть в реестре и
      // включён. Отправлять планировщик будет по id записи, адрес он читает сам.
      await this.resolveChat(existing.platform, patch.chatRecordId);

      update.chatRecordId = toId(patch.chatRecordId);
    }

    if (patch.text !== undefined) {
      const text = String(patch.text).trim();

      if (!text) throw new ValidationError("Пустой текст напоминания");
      if (text.length > CHAT_TRIGGER_RESPONSE_LIMIT) {
        throw new ValidationError(`Напоминание длиннее ${CHAT_TRIGGER_RESPONSE_LIMIT} символов`);
      }

      update.text = text;
    }

    const scheduleChanged =
      patch.scheduleKind !== undefined ||
      patch.timeOfDay !== undefined ||
      patch.weekdays !== undefined ||
      patch.dayOfMonth !== undefined ||
      patch.lastDayOfMonth !== undefined;

    if (scheduleChanged) {
      const schedule = validateReminderSchedule({
        scheduleKind: patch.scheduleKind ?? existing.schedule_kind,
        timeOfDay: patch.timeOfDay ?? existing.time_of_day,
        weekdays: patch.weekdays ?? existing.weekdays,
        dayOfMonth: patch.dayOfMonth ?? existing.day_of_month,
        lastDayOfMonth: patch.lastDayOfMonth ?? existing.last_day_of_month,
      });

      Object.assign(update, mapSchedule(schedule));
    }

    if (patch.isActive !== undefined) update.isActive = patch.isActive === true || patch.isActive === "true";

    const updated = await this.reminders.update(existing.id, update);

    return serializeReminder(updated);
  }

  async deleteReminder({ id }) {
    const existing = await this.reminders.getById(toId(id));

    if (!existing) throw new NotFoundError("Напоминание не найдено");

    await this.reminders.delete(existing.id);
    this.log.info("Чат-боты: напоминание удалено", { reminder_id: String(existing.id) });

    return { deleted: String(existing.id) };
  }
}

export default ChatBotAdminUseCases;
