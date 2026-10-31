import { logger } from "../../core/utils/logger.js";
import defaultReminders from "../repositories/ChatReminderRepository.js";
import { TelegramChatRepository } from "../repositories/TelegramChatRepository.js";
import defaultMaxChats from "../repositories/MaxChatRepository.js";
import { telegramService } from "../../application/services/TelegramService.js";
import { maxBotService } from "./MaxBotService.js";
import { reminderStatus, reminderTimeZone } from "../../core/utils/chatReminderSchedule.js";

/** Тик раз в минуту — ровно то, о чём просил админ: проверка расписания не чаще. */
const TICK_INTERVAL_MS = 60_000;
/** Больше трёх попыток одного срабатывания не долбим канал: причина обычно постоянная. */
const MAX_ATTEMPTS_PER_OCCURRENCE = 3;

/** `TelegramChatRepository` экспортирует только класс — экземпляр делаем сами. */
const defaultTelegramChats = new TelegramChatRepository();

/**
 * Планировщик напоминаний.
 *
 * Ключ срабатывания пишется в базу ДО отправки, а после успешной отправки
 * помечается результатом. Отсюда два свойства, которые для автопостинга в чаты
 * живут вместо журнала:
 *  - рестарт pm2 не приводит ко второму такому же сообщению;
 *  - упавшая отправка повторяется на следующем тике, но только несколько раз.
 * Момент, пропущенный из-за простоя дольше окна догона, помечается `skipped` и
 * задним числом не отправляется — «напоминание о вчера в 15:00» бесполезно.
 */
export class ChatReminderScheduler {
  constructor({
    repository = defaultReminders,
    telegramChats = defaultTelegramChats,
    maxChats = defaultMaxChats,
    telegram = telegramService,
    max = maxBotService,
    loggerImpl,
    intervalMs = TICK_INTERVAL_MS,
    timeZone = null,
  } = {}) {
    this.reminders = repository;
    this.telegramChats = telegramChats;
    this.maxChats = maxChats;
    this.telegram = telegram;
    this.max = max;
    this.log = loggerImpl ?? logger;
    this.intervalMs = intervalMs;
    this.timeZone = timeZone;
    this.timer = null;
    this.running = false;
    this.ticking = false;
    this.stats = { ticks: 0, checked: 0, sent: 0, failed: 0, skipped: 0 };
  }

  start() {
    if (this.running) return false;

    this.running = true;
    // Первый тик не сразу: при старте процесса очередь запросов и так набегает.
    this.timer = setInterval(() => {
      this.tick().catch((error) => this.log.error("Напоминания: тик упал", { error: error.message }));
    }, this.intervalMs);

    this.log.info("Напоминания: планировщик запущен", {
      interval_ms: this.intervalMs,
      timezone: this.timeZone ?? reminderTimeZone(),
    });

    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  /** Один проход по активным напоминаниям. Открыт наружу — им и проверяют в тестах. */
  async tick({ now = new Date() } = {}) {
    if (this.ticking) return { checked: 0, sent: 0, failed: 0, skipped: 0 };

    this.ticking = true;
    const timeZone = this.timeZone ?? reminderTimeZone();
    const results = { checked: 0, sent: 0, failed: 0, skipped: 0 };

    try {
      const reminders = await this.reminders.list({ activeOnly: true });

      for (const reminder of reminders) {
        results.checked += 1;

        const outcome = await this._process(reminder, now, timeZone);

        results[outcome] += 1;
        this.stats[outcome] += 1;
      }

      this.stats.ticks += 1;

      if (results.sent || results.failed || results.skipped) {
        this.log.info("Напоминания: итог тика", { ...results });
      }
    } finally {
      this.ticking = false;
    }

    return results;
  }

  async _process(reminder, now, timeZone) {
    const status = reminderStatus(reminder, now, timeZone);

    if (!status.key) return "checked";

    if (status.missed) {
      if (reminder.last_occurrence_key === status.key) return "checked";

      await this.reminders.recordSkipped(reminder.id, status.key);
      this.log.warn("Напоминания: момент пропущен (процесс стоял дольше окна догона)", {
        reminder_id: String(reminder.id),
        occurrence: status.key,
      });

      return "skipped";
    }

    if (!status.due) return "checked";

    const alreadyHandled =
      reminder.last_occurrence_key === status.key &&
      (reminder.last_result === "sent" ||
        reminder.last_result === "skipped" ||
        Number(reminder.failed_attempts) >= MAX_ATTEMPTS_PER_OCCURRENCE);

    if (alreadyHandled) return "checked";

    // Занимаем срабатывание до отправки: если процесс умрёт между request'ом и
    // ответом канала, повторного сообщения следующий тик уже не допустит.
    await this.reminders.beginOccurrence(reminder.id, status.key);

    const error = await this._send(reminder);

    if (!error) {
      await this.reminders.recordSuccess(reminder.id);
      this.log.info("Напоминания: отправлено", {
        reminder_id: String(reminder.id),
        platform: reminder.platform,
        occurrence: status.key,
      });

      return "sent";
    }

    await this.reminders.recordFailure(reminder.id, error);
    this.log.error("Напоминания: не отправлено", {
      reminder_id: String(reminder.id),
      platform: reminder.platform,
      occurrence: status.key,
      error,
    });

    return "failed";
  }

  /** @returns {Promise<string|null>} текст ошибки или null, если чат принял сообщение. */
  async _send(reminder) {
    if (reminder.platform === "telegram") {
      const chat = await this.telegramChats.getById(reminder.chat_record_id);

      if (!chat) return "чат Telegram не найден в реестре";
      if (!chat.is_active) return `чат «${chat.name}» выключен`;

      const { results } = await this.telegram.sendMessage({
        message: reminder.text,
        chatIds: [String(chat.chat_id)],
        threadIds: [chat.thread_id ?? undefined],
        // Напоминание — обычный текст: HTML-разметку в него подставлять нечем, а
        // «<» в тексте ломает отправку с ошибкой парсинга.
        parse_mode: undefined,
      });

      return results?.[0]?.success ? null : results?.[0]?.error ?? "Telegram не принял сообщение";
    }

    const chat = await this.maxChats.getById(reminder.chat_record_id);

    if (!chat) return "чат MAX не найден в реестре";
    if (!chat.is_active) return `чат «${chat.name}» выключен`;

    const sent = await this.max.sendChatMessage(String(chat.chat_id), reminder.text);

    return sent.ok ? null : sent.error ?? "MAX не принял сообщение";
  }
}

export default new ChatReminderScheduler();
