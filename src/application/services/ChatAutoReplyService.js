import { logger } from "../../core/utils/logger.js";
import defaultRepository from "../../infrastructure/repositories/ChatAutoReplyRepository.js";
import { CHAT_BOT_PLATFORM, matchAutoReply } from "../../core/utils/chatAutoReply.js";

/**
 * Условия автоответа живут в базе, а сообщения в чате приходят потоком:
 * список условий держим в памяти несколько секунд, чтобы не ходить в БД на
 * каждое сообщение. Инвалидация — при любой правке из админки.
 */
const CACHE_TTL_MS = 5000;

/**
 * Один движок на оба канала. Отличается только то, как канал понимает «это
 * групповой чат»: у Telegram это надёжный `chat.type`, у MAX мы сверяемся с
 * реестром чатов (см. вызывающие стороны).
 */
export class ChatAutoReplyService {
  constructor({ repository = defaultRepository, loggerImpl, ttlMs = CACHE_TTL_MS } = {}) {
    this.repository = repository;
    this.log = loggerImpl ?? logger;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  invalidate(platform = null) {
    if (platform) this.cache.delete(platform);
    else this.cache.clear();
  }

  async activeReplies(platform) {
    const cached = this.cache.get(platform);

    if (cached && cached.expiresAt > Date.now()) return cached.replies;

    let replies = [];

    try {
      replies = await this.repository.list({ platform, activeOnly: true });
    } catch (error) {
      // Автоответ — не критичный путь: без списка условий просто молчим.
      this.log.warn("Чат-боты: список условий автоответа не прочитан", {
        platform,
        error: error.message,
      });
      return [];
    }

    this.cache.set(platform, { replies, expiresAt: Date.now() + this.ttlMs });

    return replies;
  }

  /**
   * @returns {Promise<{reply: object|null}>} найденное условие или null.
   */
  async match({ platform, text }) {
    if (!text) return { reply: null };

    const replies = await this.activeReplies(platform);

    return { reply: matchAutoReply(replies, text) };
  }

  /**
   * Общий вход для обоих ботов: подобрать ответ и отправить его в чат.
   *
   * @param {object} params
   * @param {'telegram'|'max'} params.platform
   * @param {string} params.chatLabel — что писать в лог (id чата)
   * @param {string} params.text — текст сообщения из чата
   * @param {(response: string) => Promise<{ok?:boolean, skipped?:boolean, error?:string}>} params.send
   * @returns {Promise<{sent: boolean, phrase: string|null, error: string|null}>}
   */
  async handleChatMessage({ platform, chatLabel, text, send }) {
    const { reply } = await this.match({ platform, text });

    if (!reply) return { sent: false, phrase: null, error: null };

    try {
      const result = await send(reply.response);

      if (result && result.ok === false) {
        this.log.warn("Чат-боты: автоответ не отправлен", {
          platform,
          chat: chatLabel,
          trigger_id: String(reply.id),
          error: result.error,
        });

        return { sent: false, phrase: reply.phrase, error: result.error ?? "чат не принял ответ" };
      }

      this.log.info("Чат-боты: автоответ отправлен", {
        platform,
        chat: chatLabel,
        trigger_id: String(reply.id),
        phrase: reply.phrase,
      });

      return { sent: true, phrase: reply.phrase, error: null };
    } catch (error) {
      this.log.error("Чат-боты: сбой автоответа", {
        platform,
        chat: chatLabel,
        error: error.message,
      });

      return { sent: false, phrase: reply.phrase, error: error.message };
    }
  }
}

export { CHAT_BOT_PLATFORM };
export default new ChatAutoReplyService();
