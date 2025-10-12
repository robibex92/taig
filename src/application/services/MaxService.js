const axios = require("axios");
const { logger } = require("../../core/utils/logger");
const pLimit = require("p-limit");

/**
 * MAX Messaging Service
 * Centralized service for MAX Platform Bot API interactions
 * Documentation: https://dev.max.ru/docs
 */
class MaxService {
  constructor() {
    this.botToken = process.env.MAX_BOT_TOKEN;
    this.apiUrl = process.env.MAX_API_URL || "https://api.max.ru/bot";
    this.limit = pLimit(30); // MAX API rate limit (30 requests per second)
    this.enabled = process.env.ENABLE_MAX_AUTH === "true";
  }

  /**
   * Check if MAX service is enabled
   */
  isEnabled() {
    return this.enabled && !!this.botToken;
  }

  /**
   * Send message to MAX chat
   */
  async sendMessage({ chat_id, text, keyboard = null, attachments = [] }) {
    if (!this.isEnabled()) {
      logger.warn("MAX service is disabled");
      return null;
    }

    return this.limit(async () => {
      try {
        const payload = {
          chat_id,
          text,
          ...(keyboard && { keyboard }),
          ...(attachments.length > 0 && { attachments }),
        };

        const response = await axios.post(
          `${this.apiUrl}/sendMessage`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${this.botToken}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        logger.info("MAX message sent", {
          chat_id,
          message_id: response.data.message_id,
        });
        return response.data;
      } catch (error) {
        logger.error("MAX send message error", {
          chat_id,
          error: error.message,
          response: error.response?.data,
        });
        throw error;
      }
    });
  }

  /**
   * Edit existing MAX message
   */
  async editMessage({ chat_id, message_id, text, keyboard = null }) {
    if (!this.isEnabled()) {
      return;
    }

    return this.limit(async () => {
      try {
        await axios.post(
          `${this.apiUrl}/editMessage`,
          {
            chat_id,
            message_id,
            text,
            ...(keyboard && { keyboard }),
          },
          {
            headers: {
              Authorization: `Bearer ${this.botToken}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        logger.info("MAX message edited", { chat_id, message_id });
      } catch (error) {
        logger.error("MAX edit message error", {
          chat_id,
          message_id,
          error: error.message,
        });
      }
    });
  }

  /**
   * Delete MAX message
   */
  async deleteMessage({ chat_id, message_id }) {
    if (!this.isEnabled()) {
      return;
    }

    return this.limit(async () => {
      try {
        await axios.post(
          `${this.apiUrl}/deleteMessage`,
          {
            chat_id,
            message_id,
          },
          {
            headers: {
              Authorization: `Bearer ${this.botToken}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        logger.info("MAX message deleted", { chat_id, message_id });
      } catch (error) {
        logger.error("MAX delete message error", {
          chat_id,
          message_id,
          error: error.message,
        });
      }
    });
  }

  /**
   * Post ad to MAX chats
   */
  async postAd(ad, chatIds) {
    if (!this.isEnabled() || !chatIds || chatIds.length === 0) {
      return [];
    }

    const text = this._buildAdText(ad);
    const results = [];

    for (const chat_id of chatIds) {
      try {
        const result = await this.sendMessage({
          chat_id,
          text,
          keyboard: this._buildAdKeyboard(ad),
        });

        if (result) {
          results.push({
            chat_id,
            message_id: result.message_id,
          });
        }
      } catch (error) {
        logger.error("Failed to post ad to MAX chat", {
          ad_id: ad.id,
          chat_id,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Update ad in MAX chats
   */
  async updateAd(ad, messageIds) {
    if (!this.isEnabled() || !messageIds || messageIds.length === 0) {
      return;
    }

    const text = this._buildAdText(ad);

    for (const { chat_id, message_id } of messageIds) {
      try {
        await this.editMessage({
          chat_id,
          message_id,
          text,
          keyboard: this._buildAdKeyboard(ad),
        });
      } catch (error) {
        logger.error("Failed to update ad in MAX chat", {
          ad_id: ad.id,
          chat_id,
          message_id,
          error: error.message,
        });
      }
    }
  }

  /**
   * Delete ad from MAX chats
   */
  async deleteAd(messageIds) {
    if (!this.isEnabled() || !messageIds || messageIds.length === 0) {
      return;
    }

    for (const { chat_id, message_id } of messageIds) {
      try {
        await this.deleteMessage({ chat_id, message_id });
      } catch (error) {
        logger.error("Failed to delete ad from MAX chat", {
          chat_id,
          message_id,
          error: error.message,
        });
      }
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(max_id, notification) {
    if (!this.isEnabled()) {
      return;
    }

    const { type, data } = notification;
    let text, keyboard;

    switch (type) {
      case "new_booking":
        ({ text, keyboard } = this._buildBookingNotification(
          data.booking,
          data.queuePosition
        ));
        break;
      case "booking_status":
        ({ text, keyboard } = this._buildBookingStatusNotification(
          data.booking,
          data.status
        ));
        break;
      case "ad_archived":
        text = this._buildAdArchivedNotification(data.ad, data.stats);
        break;
      default:
        text = notification.message || "Новое уведомление";
    }

    try {
      await this.sendMessage({
        chat_id: max_id,
        text,
        keyboard,
      });
    } catch (error) {
      logger.error("Failed to send MAX notification", {
        max_id,
        type,
        error: error.message,
      });
    }
  }

  // ============= Message Builders =============

  /**
   * Build ad text
   */
  _buildAdText(ad) {
    const statusEmoji = {
      active: "✅",
      archived: "📦",
      closed: "❌",
    };

    let text = `${statusEmoji[ad.status] || ""} **${ad.title}**\n\n`;
    text += `${ad.description}\n\n`;

    if (ad.price) {
      text += `💰 Цена: ${ad.price} ₽\n`;
    }

    text += `📅 Опубликовано: ${new Date(ad.created_at).toLocaleDateString(
      "ru-RU"
    )}\n`;
    text += `👁 Просмотров: ${ad.view_count || 0}`;

    return text;
  }

  /**
   * Build ad keyboard
   */
  _buildAdKeyboard(ad) {
    return {
      type: "inline",
      buttons: [
        [
          {
            text: "📖 Подробнее",
            url: `${process.env.FRONTEND_URL}/ads/${ad.id}`,
          },
        ],
      ],
    };
  }

  /**
   * Build booking notification
   */
  _buildBookingNotification(booking, queuePosition) {
    return {
      text: `🔔 **Новое бронирование!**\n\n📢 Объявление: ${
        booking.ad.title
      }\n👤 Покупатель: ${
        booking.user.first_name
      }\n📊 Позиция в очереди: ${queuePosition}\n\n${booking.message || ""}`,
      keyboard: {
        type: "inline",
        buttons: [
          [
            {
              text: "✅ Подтвердить",
              callback_data: JSON.stringify({
                action: "confirm_booking",
                booking_id: booking.id,
              }),
            },
            {
              text: "❌ Отклонить",
              callback_data: JSON.stringify({
                action: "reject_booking",
                booking_id: booking.id,
              }),
            },
          ],
        ],
      },
    };
  }

  /**
   * Build booking status notification
   */
  _buildBookingStatusNotification(booking, status) {
    const statusText = {
      confirmed: "✅ подтверждено",
      rejected: "❌ отклонено",
      cancelled: "🚫 отменено",
    };

    return {
      text: `📬 Ваше бронирование ${statusText[status]}!\n\n📢 Объявление: ${
        booking.ad.title
      }\n\n${booking.seller_note || ""}`,
      keyboard: {
        type: "inline",
        buttons: [
          [
            {
              text: "📖 Открыть объявление",
              url: `${process.env.FRONTEND_URL}/ads/${booking.ad_id}`,
            },
          ],
        ],
      },
    };
  }

  /**
   * Build ad archived notification
   */
  _buildAdArchivedNotification(ad, stats) {
    return `📦 **Ваше объявление автоматически архивировано**\n\n📢 ${ad.title}\n\n📊 Статистика:\n👁 Просмотров: ${stats.view_count}\n💬 Комментариев: ${stats.comments_count}\n🔖 Бронирований: ${stats.bookings_count}`;
  }

  /**
   * Verify MAX launch params signature
   */
  verifySignature(params, botSecret) {
    const crypto = require("crypto");
    const { hash, ...dataToCheck } = params;

    // Create data check string: key=value\nkey=value (sorted by keys)
    const dataCheckString = Object.keys(dataToCheck)
      .sort()
      .map((key) => `${key}=${dataToCheck[key]}`)
      .join("\n");

    // Create secret key: HMAC-SHA256(bot_token, "WebAppData")
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botSecret)
      .digest();

    // Calculate hash: HMAC-SHA256(secret_key, data_check_string)
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return calculatedHash === hash;
  }
}

module.exports = MaxService;
