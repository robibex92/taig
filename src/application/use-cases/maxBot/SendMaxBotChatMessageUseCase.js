import { logger } from "../../../core/utils/logger.js";
import { ValidationError } from "../../../core/errors/AppError.js";
import defaultChats from "../../../infrastructure/repositories/MaxChatRepository.js";
import { maxBotService as defaultService } from "../../../infrastructure/services/MaxBotService.js";
import {
  MAX_BOT_RECIPIENT_STATUS,
  validateMaxBotChatIds,
  validateMaxBotText,
} from "../../../core/constants/maxBot.js";
import { PUBLISH_DELAY_MS, sleep } from "../ad/adPublishing.js";

/**
 * Разовая отправка текста в выбранные чаты реестра `max_chats` (вкладка
 * «MAX-бот» → секция «Чаты»).
 *
 * Чем это не является:
 *  - Не рассылка жителям: `MaxBotBroadcastUseCases` ходит в личные диалоги по
 *    `users.max_id`, здесь адрес — групповой чат.
 *  - Не публикация объявления: `publishToMaxChats` привязана к объявлению и
 *    заводит журнал сообщений, чтобы снять их при архиве или repost'е. У ручного
 *    сообщения журнала нет, поэтому и «удалить отправленное» нечем.
 *
 * Ответ собирается сразу: чатов в одной отправке не десятки тысяч, пауза между
 * ними та же, что при публикации объявлений. Фоновым поллингом результат не
 * догоняется.
 */

const skippedChat = (id) => ({
  max_chat_id: id,
  name: null,
  purpose: null,
  status: MAX_BOT_RECIPIENT_STATUS.SKIPPED,
  error: "Чат не найден в активном реестре (выключен или удалён)",
});

/**
 * Экран админки оперирует статусами получателей рассылки — тот же набор, что у
 * `MaxBotRecipient`, чтобы не заводить второй словарь подписей на фронте.
 */
const chatResult = (chat, status, error = null) => ({
  max_chat_id: String(chat.id),
  name: chat.name,
  purpose: chat.purpose,
  status,
  error,
});

export class SendMaxBotChatMessageUseCase {
  constructor({
    chatRepository = defaultChats,
    service = defaultService,
    loggerImpl,
  } = {}) {
    this.chats = chatRepository;
    this.service = service;
    this.log = loggerImpl ?? logger;
  }

  /**
   * id реестра → активные чаты.
   *
   * Не найденный или выключенный id не отправляется молча: он возвращается в
   * результирующем списке, иначе админ читает «готово» там, где половина
   * адресов просто исчезла.
   */
  async _resolve(selectedIds) {
    const active = await this.chats.getActiveChats(null, false);
    const picked = [];
    const missing = [];

    // Порядок — как выбрал админ, а не как отсортирован реестр.
    for (const id of selectedIds) {
      const chat = active.find((item) => String(item.id) === id);

      if (chat) {
        picked.push(chat);
      } else {
        missing.push(id);
        this.log.warn("MAX chat send: чат не найден в активном реестре", { chat_record_id: id });
      }
    }

    return { picked, missing };
  }

  async send({ text, maxChatIds, actorUserId = null }) {
    const message = validateMaxBotText(text);
    const selectedIds = validateMaxBotChatIds(maxChatIds);

    if (!this.service.isConfigured()) {
      throw new ValidationError("MAX_BOT_TOKEN не задан — отправка невозможна");
    }

    const { picked, missing } = await this._resolve(selectedIds);

    if (!picked.length) {
      throw new ValidationError("Ни один из выбранных чатов не активен — отправлять некуда");
    }

    const items = missing.map(skippedChat);

    for (const chat of picked) {
      items.push(await this._sendOne(chat, message, actorUserId));
      await sleep(PUBLISH_DELAY_MS);
    }

    const count = (status) => items.filter((item) => item.status === status).length;

    return {
      total: items.length,
      sent: count(MAX_BOT_RECIPIENT_STATUS.SENT),
      failed: count(MAX_BOT_RECIPIENT_STATUS.FAILED),
      skipped: count(MAX_BOT_RECIPIENT_STATUS.SKIPPED),
      items,
    };
  }

  /**
   * Один чат. Сбой не отменяет остальные и не превращается в 500: админ уже
   * нажал «отправить», и половина принятых адресов — это тоже результат.
   */
  async _sendOne(chat, message, actorUserId) {
    const chatId = String(chat.chat_id);

    try {
      const sent = await this.service.sendChatMessage(chatId, message);

      if (sent.ok) {
        this.log.info("MAX chat send: сообщение принято чатом", {
          chat_id: chatId,
          message_id: sent.message_id,
          actor_user_id: actorUserId,
        });

        return chatResult(chat, MAX_BOT_RECIPIENT_STATUS.SENT);
      }

      const status = sent.skipped
        ? MAX_BOT_RECIPIENT_STATUS.SKIPPED
        : MAX_BOT_RECIPIENT_STATUS.FAILED;

      this.log.error("MAX chat send: чат не принял сообщение", {
        chat_id: chatId,
        error: sent.error,
        code: sent.code,
      });

      return chatResult(chat, status, sent.error);
    } catch (error) {
      this.log.error("MAX chat send: сбой отправки", { chat_id: chatId, error: error.message });

      return chatResult(chat, MAX_BOT_RECIPIENT_STATUS.FAILED, error.message);
    }
  }
}

export default SendMaxBotChatMessageUseCase;
