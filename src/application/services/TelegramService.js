import TelegramBot from "node-telegram-bot-api";
import pLimit from "p-limit";
import { logger } from "../../core/utils/logger.js";

// Initialize bot instance
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

/**
 * Centralized Telegram Service
 * Handles all Telegram API interactions with queue management
 */
export class TelegramService {
  constructor(adRepository = null, postRepository = null) {
    this.adRepository = adRepository;
    this.postRepository = postRepository;
    this.bot = bot;

    // Rate limiting: 1 request at a time with 2 second delay
    this.limit = pLimit(1);
    this.delay = 2000; // 2 seconds between requests
  }

  /**
   * Send message to Telegram (text or media)
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async sendMessage({
    message,
    chatIds,
    threadIds = [],
    photos = [],
    mediaGroup = null,
    parse_mode = "HTML",
  }) {
    const results = [];

    for (let i = 0; i < chatIds.length; i++) {
      const chatId = chatIds[i];
      const threadId = threadIds[i] || undefined;

      const result = await this.limit(async () => {
        try {
          let response;

          // Send media group
          if (
            mediaGroup &&
            Array.isArray(mediaGroup) &&
            mediaGroup.length > 0
          ) {
            response = await bot.sendMediaGroup(chatId, mediaGroup, {
              message_thread_id: threadId,
            });

            // Format response
            response = response.map((msg) => ({
              message_id: msg.message_id,
              media_group_id: msg.media_group_id || null,
            }));
          }
          // Send single photo
          else if (photos && Array.isArray(photos) && photos.length > 0) {
            response = await bot.sendPhoto(chatId, photos[0], {
              caption: message,
              parse_mode,
              message_thread_id: threadId,
            });

            response = [
              {
                message_id: response.message_id,
                media_group_id: null,
              },
            ];
          }
          // Send text only
          else {
            response = await bot.sendMessage(chatId, message, {
              parse_mode,
              message_thread_id: threadId,
            });

            response = [
              {
                message_id: response.message_id,
                media_group_id: null,
              },
            ];
          }

          logger.info("Telegram message sent", {
            chatId,
            threadId,
            messageCount: response.length,
          });

          // Delay before next request
          await this._delay();

          return { chatId, threadId, result: response, success: true };
        } catch (error) {
          logger.error("Error sending Telegram message", {
            chatId,
            error: error.message,
          });
          return { chatId, threadId, error: error.message, success: false };
        }
      });

      results.push(result);
    }

    return { results };
  }

  /**
   * Update Telegram message text
   */
  async editMessageText({
    chatId,
    messageId,
    text,
    threadId,
    parse_mode = "HTML",
  }) {
    return await this.limit(async () => {
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode,
          message_thread_id: threadId,
        });

        logger.info("Telegram message text updated", { chatId, messageId });
        await this._delay();
        return { success: true };
      } catch (error) {
        logger.error("Error editing Telegram message text", {
          chatId,
          messageId,
          error: error.message,
        });
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Update Telegram message caption (for media)
   */
  async editMessageCaption({
    chatId,
    messageId,
    caption,
    threadId,
    parse_mode = "HTML",
  }) {
    return await this.limit(async () => {
      try {
        await bot.editMessageCaption(caption, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode,
          message_thread_id: threadId,
        });

        logger.info("Telegram message caption updated", { chatId, messageId });
        await this._delay();
        return { success: true };
      } catch (error) {
        logger.error("Error editing Telegram message caption", {
          chatId,
          messageId,
          error: error.message,
        });
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Update Telegram message media
   */
  async editMessageMedia({
    chatId,
    messageId,
    mediaUrl,
    caption,
    threadId,
    parse_mode = "HTML",
  }) {
    return await this.limit(async () => {
      try {
        const media = {
          type: "photo",
          media: mediaUrl,
          caption: caption,
          parse_mode: parse_mode,
        };

        await bot.editMessageMedia(media, {
          chat_id: chatId,
          message_id: messageId,
          message_thread_id: threadId,
        });

        logger.info("Telegram message media updated", { chatId, messageId });
        await this._delay();
        return { success: true };
      } catch (error) {
        logger.error("Error editing Telegram message media", {
          chatId,
          messageId,
          error: error.message,
        });
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Delete Telegram message
   */
  async deleteMessage({ chatId, messageId, threadId }) {
    return await this.limit(async () => {
      try {
        await bot.deleteMessage(chatId, messageId, {
          message_thread_id: threadId,
        });

        logger.info("Telegram message deleted", { chatId, messageId });
        await this._delay();
        return { success: true };
      } catch (error) {
        logger.error("Error deleting Telegram message", {
          chatId,
          messageId,
          error: error.message,
        });
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Delete multiple Telegram messages
   */
  async deleteMessages(messages) {
    const results = [];

    for (const msg of messages) {
      const result = await this.deleteMessage({
        chatId: msg.chat_id,
        messageId: msg.message_id,
        threadId: msg.thread_id,
      });
      results.push({ ...msg, ...result });
    }

    return results;
  }

  /**
   * Build message text for ad
   */
  buildAdMessageText({ title, content, price, username, user_id, ad_id }) {
    let text = `📢 <b>${this._escapeHtml(title)}</b>\n\n`;
    text += `${this._escapeHtml(content)}\n\n`;

    if (price) {
      text += `💰 Цена: <b>${this._escapeHtml(price)}</b>\n\n`;
    }

    if (username) {
      text += `👤 Автор: @${this._escapeHtml(username)}\n`;
    } else if (user_id) {
      text += `👤 Автор: <a href="tg://user?id=${user_id}">ID ${user_id}</a>\n`;
    }

    text += `\n🔗 Просмотреть: https://taiginsky.md/ads/${ad_id}`;

    return text;
  }

  /**
   * Build message text for post
   */
  buildPostMessageText({ title, content, post_id }) {
    let text = `🚨 <b>${this._escapeHtml(title)}</b> 🚨\n`;
    text += `🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸\n\n`;
    text += `${this._escapeHtml(content)}`;

    if (post_id) {
      text += `\n\n🔗 Подробнее: https://taiginsky.md/posts/${post_id}`;
    }

    return text;
  }

  /**
   * Build message text for context-based messages (car, apartment, feedback)
   */
  buildContextMessage({
    message,
    contextType,
    contextData,
    user_id,
    dbUsername,
  }) {
    let header = "";

    if (contextType === "announcement") {
      header = `📢 <b>Вам отправлено сообщение по объявлению "${this._escapeHtml(
        contextData?.title || ""
      )}"</b> 📢\n\n`;
    } else if (contextType === "car") {
      header = `🚗 <b>Вам отправлено сообщение по автомобилю ${this._escapeHtml(
        contextData?.car_brand || ""
      )} ${this._escapeHtml(contextData?.car_model || "")}</b> 🚗\n\n`;
    } else if (contextType === "apartment") {
      header = `🏠 <b>Вам отправлено сообщение по квартире ${this._escapeHtml(
        String(contextData?.number || "")
      )}</b> 🏠\n\n`;
    } else if (contextType === "feedback") {
      header = `💬 <b>Обратная связь с сайта</b> 💬\n\n`;
    }

    // Format author information
    let authorLink;
    if (contextType === "feedback") {
      if (user_id && dbUsername && dbUsername.trim() !== "") {
        authorLink = `Обратная связь от: <b>@${this._escapeHtml(
          dbUsername
        )}</b>`;
      } else if (user_id) {
        authorLink = `Обратная связь от: <a href="tg://user?id=${user_id}"><b>ID ${user_id}</b></a>`;
      } else {
        authorLink = `Обратная связь от: <b>Неавторизованный пользователь</b>`;
      }
    } else {
      authorLink =
        dbUsername && dbUsername.trim() !== ""
          ? `Сообщение от: <b>@${this._escapeHtml(dbUsername)}</b>`
          : user_id
          ? `Сообщение от: <a href="tg://user?id=${user_id}"><b>ID ${user_id}</b></a>`
          : `Сообщение от: <b>Не определен</b>`;
    }

    return `${header}${this._escapeHtml(message)}\n\n${authorLink}`;
  }

  /**
   * Queue a Telegram task (non-blocking)
   */
  queueTask(task) {
    setImmediate(async () => {
      try {
        await task();
      } catch (error) {
        logger.error("Telegram queued task error", { error: error.message });
      }
    });
  }

  /**
   * Helper: Escape HTML characters
   */
  _escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Helper: Delay execution
   */
  async _delay() {
    return new Promise((resolve) => setTimeout(resolve, this.delay));
  }
}

export default TelegramService;
