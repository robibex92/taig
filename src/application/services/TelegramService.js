import { Telegraf } from "telegraf";
import pLimit from "p-limit";
import { logger } from "../../core/utils/logger.js";

// Initialize bot instance
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

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
            response = await bot.telegram.sendMediaGroup(chatId, mediaGroup, {
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
          // Send text only
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
   * Send booking notification to seller
   */
  async sendBookingNotification({
    sellerTelegramId,
    buyerName,
    buyerUsername,
    adTitle,
    adPrice,
    bookingOrder,
    adId,
  }) {
    try {
      const orderTexts = {
        1: "первым",
        2: "вторым",
        3: "третьим",
        4: "четвертым",
        5: "пятым",
      };
      const orderText = orderTexts[bookingOrder] || `${bookingOrder}-м`;

      const buyerDisplay = buyerUsername
        ? `@${this._escapeHtml(buyerUsername)}`
        : this._escapeHtml(buyerName || "Не указано");

      let message = `🔔 <b>Новое бронирование!</b>\n\n`;
      message += `👤 Пользователь: ${buyerDisplay}\n`;
      message += `📦 Объявление: <b>${this._escapeHtml(adTitle)}</b>\n`;

      if (adPrice) {
        message += `💰 Цена: <b>${this._escapeHtml(adPrice)}</b> ₽\n`;
      }

      message += `📊 Забронировал: <b>${orderText}</b>\n\n`;
      message += `Всего бронирований: <b>${bookingOrder}</b>\n\n`;
      message += `🔗 Просмотреть: https://taiginsky.md/ads/${adId}`;

      const result = await this.sendMessage({
        message,
        chatIds: [sellerTelegramId],
        parse_mode: "HTML",
      });

      logger.info("Booking notification sent", {
        sellerTelegramId,
        adId,
        bookingOrder,
      });

      return result;
    } catch (error) {
      logger.error("Error sending booking notification", {
        error: error.message,
        sellerTelegramId,
        adId,
      });
      throw error;
    }
  }

  /**
   * Send booking cancellation notification to seller
   */
  async sendBookingCancellationNotification({
    sellerTelegramId,
    buyerName,
    buyerUsername,
    adTitle,
    bookingOrder,
    adId,
  }) {
    try {
      const orderTexts = {
        1: "первым",
        2: "вторым",
        3: "третьим",
        4: "четвертым",
        5: "пятым",
      };
      const orderText = orderTexts[bookingOrder] || `${bookingOrder}-м`;

      const buyerDisplay = buyerUsername
        ? `@${this._escapeHtml(buyerUsername)}`
        : this._escapeHtml(buyerName || "Не указано");

      let message = `❌ <b>Отмена бронирования</b>\n\n`;
      message += `👤 Пользователь: ${buyerDisplay}\n`;
      message += `📦 Объявление: <b>${this._escapeHtml(adTitle)}</b>\n`;
      message += `📊 Был: <b>${orderText}</b>\n\n`;
      message += `Пользователь передумал.\n\n`;
      message += `🔗 Просмотреть: https://taiginsky.md/ads/${adId}`;

      const result = await this.sendMessage({
        message,
        chatIds: [sellerTelegramId],
        parse_mode: "HTML",
      });

      logger.info("Booking cancellation notification sent", {
        sellerTelegramId,
        adId,
        bookingOrder,
      });

      return result;
    } catch (error) {
      logger.error("Error sending booking cancellation notification", {
        error: error.message,
        sellerTelegramId,
        adId,
      });
      throw error;
    }
  }

  /**
   * Publish ad to Telegram chat
   * @param {Object} ad - Ad entity
   * @param {string} chatId - Telegram chat ID
   * @param {string|null} threadId - Telegram thread ID (for topics)
   */
  async publishAd(ad, chatId, threadId) {
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
      const photos = images.map((img) => img.image_url || img.url);

      // Send message to Telegram
      const result = await this.sendMessage({
        message,
        chatIds: [chatId],
        threadIds: [threadId || undefined],
        photos,
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
                is_media: photos.length > 0,
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

      logger.info("Ad published to Telegram", {
        ad_id: ad.id,
        chat_id: chatId,
        thread_id: threadId,
      });

      return result;
    } catch (error) {
      logger.error("Error publishing ad to Telegram", {
        ad_id: ad.id,
        chat_id: chatId,
        error: error.message,
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

export default TelegramService;
