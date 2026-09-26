import { prisma } from "../../infrastructure/database/prisma.js";
import { logger } from "../../core/utils/logger.js";
import { maxBotService } from "../../infrastructure/services/MaxBotService.js";
import { telegramService as sharedTelegramService } from "./TelegramService.js";

/**
 * Доставка личного сообщения человеку, а не «в чат с номером из клиента».
 *
 * До этого каждый вызывающий сам решал, какой id подставить в `chatIds`:
 * объявления и авто подставляли `users.user_id`, паркинг — `receiver.user_id`,
 * и только соседи передавали настоящий `id_telegram`. В БД `user_id` —
 * autoincrement, `telegram_id` и `max_id` — отдельные колонки, поэтому такие
 * отправки уходили в несуществующий чат. Здесь один резолвер на всех.
 */

export const MESSAGE_CHANNELS = {
  TELEGRAM: "telegram",
  MAX: "max",
};

const CHANNEL_AUTO = "auto";

const toKey = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const key = String(value).trim();
  return /^\d+$/.test(key) ? key : null;
};

export class MessageDeliveryService {
  constructor({
    telegramService = sharedTelegramService,
    maxService = maxBotService,
    db = prisma,
  } = {}) {
    this.telegramService = telegramService;
    this.maxService = maxService;
    this.db = db;
  }

  /**
   * Человек по любому из известных ключей.
   *
   * `idTelegram` — колонка `houses.id_telegram`: в ней исторически лежит то
   * `telegram_id` (вход через Telegram), то `user_id` (MAX-only аккаунт),
   * поэтому ищем по обоим полям сразу (см. house/apartmentAccess.js).
   */
  async findRecipient({ userId, idTelegram } = {}) {
    const keys = [...new Set([toKey(userId), toKey(idTelegram)].filter(Boolean))];
    if (keys.length === 0) return null;

    const ids = keys.map((key) => BigInt(key));

    return this.db.user.findFirst({
      where: { OR: [{ user_id: { in: ids } }, { telegram_id: { in: ids } }] },
      select: { user_id: true, telegram_id: true, max_id: true },
    });
  }

  channelsOf(recipient) {
    return {
      telegram: Boolean(recipient?.telegram_id),
      max: Boolean(recipient?.max_id),
    };
  }

  /**
   * Какие каналы доступны для получателя — ответ наружу только в таком виде:
   * чужие `telegram_id`/`max_id` клиенту не показываются.
   */
  async availability({ userId, idTelegram } = {}) {
    const recipient = await this.findRecipient({ userId, idTelegram });
    if (!recipient) return { found: false, telegram: false, max: false };

    return { found: true, ...this.channelsOf(recipient) };
  }

  /**
   * @param {'telegram'|'max'|'auto'} channel — `auto` выбирает Telegram, если он
   *   привязан, иначе MAX.
   * @param {string|((format: 'HTML'|'plain') => string)} text — функцией можно
   *   передать сборщик текста, чтобы разметка выбиралась уже по каналу: MAX
   *   показывает HTML-теги как текст.
   * @returns {{ok: boolean, channel?: string, code?: string, error?: string,
   *   skipped?: boolean, channels: {telegram: boolean, max: boolean}}}
   */
  async deliver({ userId, idTelegram, text, channel = CHANNEL_AUTO, parseMode }) {
    const recipient = await this.findRecipient({ userId, idTelegram });
    if (!recipient) {
      return this._fail({ code: "no_recipient", error: "Получатель не найден" });
    }

    const channels = this.channelsOf(recipient);
    if (!channels.telegram && !channels.max) {
      return this._fail({
        channels,
        code: "no_channel",
        error: "У получателя не привязан ни один мессенджер",
      });
    }

    const chosen =
      channel === CHANNEL_AUTO || !channel
        ? channels.telegram
          ? MESSAGE_CHANNELS.TELEGRAM
          : MESSAGE_CHANNELS.MAX
        : channel;

    if (!channels[chosen]) {
      return this._fail({
        channel: chosen,
        channels,
        code: "channel_unavailable",
        error: chosen === MESSAGE_CHANNELS.TELEGRAM
          ? "У получателя нет Telegram"
          : "У получателя нет MAX",
      });
    }

    const message = String(
      typeof text === "function"
        ? text(chosen === MESSAGE_CHANNELS.TELEGRAM ? "HTML" : "plain")
        : text ?? ""
    ).trim();

    if (!message) {
      return this._fail({ code: "empty.text", error: "Пустой текст сообщения" });
    }

    return chosen === MESSAGE_CHANNELS.TELEGRAM
      ? this._sendTelegram({
          recipient,
          message,
          parseMode: parseMode ?? "HTML",
          channels,
        })
      : this._sendMax({ recipient, message, channels });
  }

  async _sendTelegram({ recipient, message, parseMode, channels }) {
    try {
      const { results } = await this.telegramService.sendMessage({
        message,
        chatIds: [String(recipient.telegram_id)],
        parse_mode: parseMode,
      });

      const first = results?.[0];
      if (!first?.success) {
        logger.error("Telegram delivery failed", { chatId: String(recipient.telegram_id), error: first?.error });
        return {
          ok: false,
          channel: MESSAGE_CHANNELS.TELEGRAM,
          channels,
          code: "telegram.failed",
          error: String(first?.error ?? "Telegram не доставил сообщение"),
        };
      }

      return { ok: true, channel: MESSAGE_CHANNELS.TELEGRAM, channels };
    } catch (error) {
      logger.error("Telegram delivery error", { error: error.message });
      return {
        ok: false,
        channel: MESSAGE_CHANNELS.TELEGRAM,
        channels,
        code: "telegram.error",
        error: error.message,
      };
    }
  }

  async _sendMax({ recipient, message, channels }) {
    const result = await this.maxService.sendMessage(String(recipient.max_id), message);

    if (result.ok) return { ok: true, channel: MESSAGE_CHANNELS.MAX, channels };

    // `skipped` — житель ни разу не писал боту: это не сбой, но и не доставка.
    return {
      ok: false,
      channel: MESSAGE_CHANNELS.MAX,
      channels,
      skipped: Boolean(result.skipped),
      code: result.code ?? "max.failed",
      error: result.error,
    };
  }

  _fail(extra) {
    return { ok: false, channels: { telegram: false, max: false }, ...extra };
  }
}

/**
 * Единственный экземпляр на процесс: он держит ссылку на общий `telegramService`
 * с его очередью, поэтому инстансов должно быть столько же.
 */
export const messageDeliveryService = new MessageDeliveryService();

export default MessageDeliveryService;
