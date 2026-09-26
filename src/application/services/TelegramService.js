import { Telegraf } from "telegraf";
import pLimit from "p-limit";
import { logger } from "../../core/utils/logger.js";
import { AdRepository } from "../../infrastructure/repositories/AdRepository.js";
import { PostRepository } from "../../infrastructure/repositories/PostRepository.js";

// Initialize bot instance
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Ссылка на страницу сайта в текстах уведомлений.
 *
 * Фронт намеренно на `HashRouter`: адрес без решётки на проде отдаёт 404, поэтому
 * форма `/#/ads/5` — единственная рабочая. База читается при вызове, а не при импорте:
 * `dotenv.config()` в server.js выполняется уже после статических импортов.
 */
const frontendBase = () =>
  (process.env.FRONTEND_URL || "https://infojk.ru").replace(/\/+$/, "");

export const frontendLink = (page) => `${frontendBase()}/#${page}`;

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

          // Отправка медиагруппы, если она есть и не пуста
          if (
            mediaGroup &&
            Array.isArray(mediaGroup) &&
            mediaGroup.length > 0
          ) {
            response = await bot.telegram.sendMediaGroup(chatId, mediaGroup, {
              message_thread_id: threadId,
            });

            // Форматирование ответа
            response = response.map((msg) => ({
              message_id: msg.message_id,
              media_group_id: msg.media_group_id || null,
            }));
          }
          // Отправка одного фото (устаревший вариант, но оставляем для обратной совместимости)
          else if (photos && Array.isArray(photos) && photos.length > 0) {
            response = await bot.telegram.sendPhoto(chatId, photos[0], {
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
          // Отправка только текста, если нет ни медиагруппы, ни фото
          else {
            response = await bot.telegram.sendMessage(chatId, message, {
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

          // Задержка перед следующим запросом
          await this._delay();

          return { chatId, threadId, result: response, success: true };
        } catch (error) {
          logger.error("Error sending Telegram message", {
            chatId,
            error: error.message,
            stack: error.stack,
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
        await bot.telegram.editMessageText(chatId, messageId, undefined, text, {
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
        await bot.telegram.editMessageCaption(
          chatId,
          messageId,
          undefined,
          caption,
          {
            parse_mode,
            message_thread_id: threadId,
          }
        );

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

        await bot.telegram.editMessageMedia(
          chatId,
          messageId,
          undefined,
          media,
          {
            message_thread_id: threadId,
          }
        );

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
   * Update Telegram ad messages with booking count
   * @param {Object} options - { adId, activeBookings }
   */
  async updateAdBookingCount({ adId, activeBookings }) {
    try {
      if (!this.adRepository) {
        logger.warn("AdRepository not initialized in TelegramService");
        return { success: false, error: "Repository not available" };
      }

      // Get all Telegram messages for this ad
      const messages = await this.adRepository.getTelegramMessagesByAdId(adId);

      if (!messages || messages.length === 0) {
        logger.info("No Telegram messages found for ad", { adId });
        return { success: true, updated: 0 };
      }

      logger.info(
        `Updating ${messages.length} Telegram messages with booking count`,
        {
          adId,
          activeBookings,
        }
      );

      // Get ad details
      const ad = await this.adRepository.findById(adId);
      if (!ad) {
        throw new Error(`Ad ${adId} not found`);
      }

      // Prepare booking status text
      const bookingText =
        activeBookings > 0
          ? `\n\n📌 <b>Забронировало: ${activeBookings} ${this._getPersonWord(
              activeBookings
            )}</b>`
          : "";

      // Update each message
      const updatePromises = messages.map(async (msg) => {
        try {
          // Get original caption (without previous booking count)
          let baseCaption =
            msg.caption || `${ad.title}\n\n${ad.content}\n\nЦена: ${ad.price}`;

          // Remove old booking count if exists
          baseCaption = baseCaption.replace(
            /\n\n📌 <b>Забронировало:.*?<\/b>/g,
            ""
          );

          // Add new booking count
          const updatedCaption = `${baseCaption}${bookingText}`;

          return await this.editMessageCaption({
            chatId: msg.chat_id,
            messageId: msg.message_id,
            caption: updatedCaption,
            threadId: msg.thread_id || undefined,
            parse_mode: "HTML",
          });
        } catch (err) {
          logger.error(`Failed to update Telegram message ${msg.message_id}`, {
            error: err.message,
            chat_id: msg.chat_id,
            message_id: msg.message_id,
          });
          return { success: false, error: err.message };
        }
      });

      const results = await Promise.allSettled(updatePromises);
      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.value?.success
      ).length;

      logger.info(
        `Updated ${successCount}/${messages.length} Telegram messages with booking count`,
        {
          adId,
          activeBookings,
        }
      );

      return { success: true, updated: successCount, total: messages.length };
    } catch (error) {
      logger.error("Error updating Telegram ad booking count", {
        error: error.message,
        adId,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Get correct word form for "person" (человек/человека/человек)
   */
  _getPersonWord(count) {
    if (count % 10 === 1 && count % 100 !== 11) {
      return "человек";
    } else if (
      [2, 3, 4].includes(count % 10) &&
      ![12, 13, 14].includes(count % 100)
    ) {
      return "человека";
    } else {
      return "человек";
    }
  }

  /**
   * Delete Telegram message
   */
  async deleteMessage({ chatId, messageId, threadId }) {
    return await this.limit(async () => {
      try {
        await bot.telegram.deleteMessage(chatId, messageId);

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
      // Ссылки `tg://user?id=` тут быть не может: это внутренний id пользователя
      // сайта, а не Telegram-аккаунт — такой чат не существует.
      text += `👤 Автор: ID ${this._escapeHtml(user_id)}\n`;
    }

    text += `\n🔗 Просмотреть: ${frontendLink(`/ads/${ad_id}`)}`;

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
      // Страницы одной новости на фронте нет — лента живёт на `/`, поэтому
      // ссылка ведёт в ленту, а не на несуществующий /posts/:id.
      text += `\n\n🔗 Все новости: ${frontendLink("/")}`;
    }

    return text;
  }

  /**
   * Build message text for context-based messages (car, apartment, feedback).
   *
   * `format: 'HTML'` — Telegram, где работает `<b>` и ссылка `tg://user?id=`.
   * `'plain'` — MAX: там теги показываются как текст, поэтому тот же самый
   * текст собирается без разметки.
   */
  buildContextMessage({
    message,
    contextType,
    contextData,
    user_id,
    telegram_id,
    dbUsername,
    format = "HTML",
  }) {
    const plain = format !== "HTML";
    const text = (value) => (plain ? String(value ?? "") : this._escapeHtml(value));
    const strong = (value) => (plain ? value : `<b>${value}</b>`);

    let header = "";

    if (contextType === "announcement") {
      header = `📢 ${strong(
        `Вам отправлено сообщение по объявлению "${text(contextData?.title || "")}"`
      )} 📢\n\n`;
    } else if (contextType === "car") {
      header = `🚗 ${strong(
        `Вам отправлено сообщение по автомобилю ${text(
          contextData?.car_brand || ""
        )} ${text(contextData?.car_model || "")}`
      )} 🚗\n\n`;
    } else if (contextType === "apartment") {
      header = `🏠 ${strong(
        `Вам отправлено сообщение по квартире ${text(String(contextData?.number || ""))}`
      )} 🏠\n\n`;
    } else if (contextType === "feedback") {
      header = `💬 ${strong("Обратная связь с сайта")} 💬\n\n`;
    }

    // Ссылка `tg://user?id=` работает только по настоящему telegram_id: внутренний
    // id сайта ведёт в несуществующий профиль, поэтому без telegram_id печатаем
    // просто ID.
    const prefix = contextType === "feedback" ? "Обратная связь от" : "Сообщение от";
    const author =
      dbUsername && dbUsername.trim() !== ""
        ? strong(`@${text(dbUsername)}`)
        : telegram_id
        ? plain
          ? `ID ${text(telegram_id)}`
          : `<a href="tg://user?id=${text(telegram_id)}">${strong(`ID ${text(telegram_id)}`)}</a>`
        : user_id
        ? `ID ${text(user_id)}`
        : strong(contextType === "feedback" ? "Неавторизованный пользователь" : "Не определен");

    return `${header}${text(message)}\n\n${prefix}: ${author}`;
  }

  /**
   * Текст уведомления владельцу объявления о брони или её отмене.
   *
   * Только текст: доставкой занимается `MessageDeliveryService` — только там
   * резолвится настоящий `telegram_id`/`max_id` получателя. Раньше вызывающий
   * подставлял в `chatIds` `users.user_id`, и уведомление уходило в
   * несуществующий чат.
   *
   * `format: 'HTML'` — Telegram, `'plain'` — MAX, где теги видны как текст.
   */
  buildBookingNotificationText({
    action,
    buyerName,
    buyerUsername,
    adTitle,
    adPrice,
    bookingOrder,
    adId,
    format = "HTML",
  }) {
    const plain = format !== "HTML";
    const text = (value) =>
      plain ? String(value ?? "") : this._escapeHtml(value);
    const strong = (value) => (plain ? value : `<b>${value}</b>`);

    const orderTexts = {
      1: "первым",
      2: "вторым",
      3: "третьим",
      4: "четвертым",
      5: "пятым",
    };
    const orderText = orderTexts[bookingOrder] || `${bookingOrder}-м`;
    const buyer = buyerUsername ? `@${buyerUsername}` : buyerName || "Не указано";

    const head =
      action === "cancelled"
        ? `❌ ${strong("Отмена бронирования")}\n\n`
        : `🔔 ${strong("Новое бронирование!")}\n\n`;

    let message = `${head}👤 Пользователь: ${text(buyer)}\n`;
    message += `📦 Объявление: ${strong(text(adTitle))}\n`;

    if (action === "cancelled") {
      message += `📊 Был: ${strong(text(orderText))}\n\n`;
      message += `Пользователь передумал.\n\n`;
    } else {
      if (adPrice) {
        message += `💰 Цена: ${strong(text(`${adPrice} ₽`))}\n`;
      }
      message += `📊 Забронировал: ${strong(text(orderText))}\n\n`;
      message += `Всего бронирований: ${strong(text(bookingOrder))}\n\n`;
    }

    return `${message}🔗 Просмотреть: ${frontendLink(`/ads/${adId}`)}`;
  }

  /**
   * Текст «вам задали вопрос по объявлению» — его бот отправляет владельцу, когда
   * кто-то отвечает на опубликованное объявление.
   *
   * Заголовок объявления и текст вопроса пишет человек, поэтому оба экранируются:
   * без этого `<b>` из объявления ломает разметку всего уведомления.
   */
  buildOwnerQuestionText({ adTitle, senderName, question, adId, format = "HTML" }) {
    const plain = format !== "HTML";
    const text = (value) =>
      plain ? String(value ?? "") : this._escapeHtml(value);
    const strong = (value) => (plain ? value : `<b>${value}</b>`);
    const italic = (value) => (plain ? value : `<i>${value}</i>`);

    let message = `📩 ${strong("Новый вопрос по вашему объявлению")}\n\n`;
    message += `📢 Объявление: ${strong(text(adTitle))}\n\n`;
    message += `👤 От: ${text(senderName)}\n`;
    message += `💬 Сообщение:\n${italic(`"${text(question)}"`)}\n\n`;

    return `${message}🔗 Просмотреть объявление: ${frontendLink(`/ads/${adId}`)}`;
  }

  /**
   * Publish ad to Telegram chat
   * @param {Object} ad - Ad entity
   * @param {string} chatId - Telegram chat ID
   * @param {string|null} threadId - Telegram thread ID (for topics)
   */
  async publishAd(ad, chatId, threadId) {
    logger.info("Starting to publish ad to Telegram", {
      ad_id: ad.id,
      chat_id: chatId,
      thread_id: threadId,
    });
    
    try {
      if (!this.adRepository) {
        logger.error("AdRepository not initialized in TelegramService");
        throw new Error("Repository not available");
      }

      // Get username - ad.user may not be loaded
      let username = null;
      if (ad.user && ad.user.username) {
        username = ad.user.username;
      } else {
        // Try to get username from telegram first name if available
        // For now, just use user_id in the link
        username = null;
      }

      // Build message text
      const message = this.buildAdMessageText({
        title: ad.title,
        content: ad.content,
        price: ad.price,
        username: username,
        user_id: ad.user_id,
        ad_id: ad.id,
      });

      // Prepare media
      const images = ad.images || [];
      let mediaGroup = null;

      if (images.length > 0) {
        mediaGroup = images.map((img, index) => {
          const media = {
            type: "photo",
            media: img.image_url || img.url,
          };
          if (index === 0) {
            media.caption = message;
            media.parse_mode = "HTML";
          }
          return media;
        });
      }

      // Send message to Telegram
      const result = await this.sendMessage({
        message,
        chatIds: [chatId],
        threadIds: [threadId || undefined],
        mediaGroup,
      });

      // Save message IDs to database
      if (result.results && result.results.length > 0) {
        const res = result.results[0];
        if (res.success && res.result) {
          // Handle array of messages (e.g., media group or single)
          const messages = Array.isArray(res.result)
            ? res.result
            : [res.result];

          for (const msg of messages) {
            if (msg && msg.message_id) {
              await this.adRepository.createTelegramMessage({
                ad_id: Number(ad.id),
                chat_id: String(chatId),
                message_id: String(msg.message_id),
                thread_id: threadId ? String(threadId) : null,
                message_text: message,
                is_media: mediaGroup && mediaGroup.length > 0,
                media_group_id: msg.media_group_id
                  ? String(msg.media_group_id)
                  : null,
              });

              logger.debug("Telegram message saved for ad", {
                ad_id: ad.id,
                message_id: msg.message_id,
              });
            }
          }
        }
      }

      logger.info("Ad successfully published to Telegram", {
        ad_id: ad.id,
        chat_id: chatId,
        thread_id: threadId,
      });

      return result;
    } catch (error) {
      logger.error("Error publishing ad to Telegram", {
        ad_id: ad.id,
        chat_id: chatId,
        thread_id: threadId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Update ad status in Telegram (edits existing messages)
   * @param {Object} updatedAd - Updated ad entity
   * @param {string} chatId - Telegram chat ID
   * @param {string} messageId - Telegram message ID
   * @param {string|null} threadId - Telegram thread ID
   */
  async updateAdStatus(updatedAd, chatId, messageId, threadId) {
    try {
      if (!this.adRepository) {
        logger.error("AdRepository not initialized in TelegramService");
        throw new Error("Repository not available");
      }

      // Get telegram message record - convert to strings to match DB types
      const telegramMsg = await this.adRepository.getTelegramMessageByMessageId(
        String(messageId),
        String(chatId)
      );

      if (!telegramMsg) {
        logger.warn("Telegram message not found in database", {
          chat_id: chatId,
          message_id: messageId,
          ad_id: updatedAd.id,
        });
        return { success: false, error: "Message not found" };
      }

      // Build updated message text
      const username = updatedAd.user?.username || null;
      const message = this.buildAdMessageText({
        title: updatedAd.title,
        content: updatedAd.content,
        price: updatedAd.price,
        username: username,
        user_id: updatedAd.user_id,
        ad_id: updatedAd.id,
      });

      // Update message in Telegram
      if (telegramMsg.is_media) {
        return await this.editMessageCaption({
          chatId,
          messageId,
          caption: message,
          threadId: threadId || undefined,
        });
      } else {
        return await this.editMessageText({
          chatId,
          messageId,
          text: message,
          threadId: threadId || undefined,
        });
      }
    } catch (error) {
      logger.error("Error updating ad status in Telegram", {
        ad_id: updatedAd.id,
        chat_id: chatId,
        message_id: messageId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
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

/**
 * Единственный экземпляр на процесс.
 *
 * Очередь `pLimit(1)` и пауза между запросами берегут от флуда один токен бота, а не
 * каждого получателя: инстансов должно быть ровно столько же. Раньше вызывающие делали
 * `new TelegramService()` на запрос, и лимитеры считались раздельно.
 */
export const telegramService = new TelegramService(
  new AdRepository(),
  new PostRepository()
);

export default TelegramService;
