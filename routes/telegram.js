// telegram.js
// This file re-creates the TelegramCreationService and exports it for use in routes.
// It uses the bot instance from services/telegramBot.js and provides a sendMessage function compatible with previous usage.

import bot from "../services/telegramBot.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";

import express from "express";
const router = express.Router();

// Маршрут для отправки сообщений в Telegram
router.post("/send", authenticateJWT, async (req, res) => {
  try {
    const { chat_id, message, contextType, contextData, sender_id } = req.body;

    if (!chat_id || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Форматируем сообщение с информацией об отправителе
    const formattedMessage = `${message}\n\nОт: ${sender_id}`;

    const result = await TelegramCreationService.sendMessage({
      message: formattedMessage,
      chatIds: [chat_id],
    });

    if (result.results[0].error) {
      throw new Error(result.results[0].error);
    }

    res.json({ success: true, result: result.results[0] });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

export const TelegramCreationService = {
  /**
   * Send message or media to Telegram chats
   * @param {Object} options
   * @param {string} options.message - text message (max 1024 chars if used as caption)
   * @param {string[]} options.chatIds - array of chat IDs
   * @param {string[]} [options.threadIds] - array of thread IDs (optional)
   * @param {Array} [options.photos] - array of photo URLs (optional)
   * @returns {Promise<{results: Array}>}
   */
  async sendMessage({ message, chatIds, threadIds = [], photos = [] }) {
    if (message.length > 1024 && photos.length > 0) {
      throw new Error("Caption exceeds 1024 characters");
    }

    const results = [];
    for (let i = 0; i < chatIds.length; ++i) {
      const chatId = chatIds[i];
      const threadId = threadIds[i] || undefined;
      try {
        let result;
        if (photos && photos.length > 0) {
          if (photos.length === 1) {
            // Одно изображение с подписью
            result = await bot.sendPhoto(chatId, photos[0], {
              caption: message,
              parse_mode: "HTML",
              message_thread_id: threadId,
            });
          } else {
            // Несколько изображений — caption только у первого
            const media = photos.map((photo, index) => ({
              type: "photo",
              media: photo,
              ...(index === 0 ? { caption: message, parse_mode: "HTML" } : {}),
            }));

            result = await bot.sendMediaGroup(chatId, media, {
              message_thread_id: threadId,
            });
          }
        } else {
          // Только текст
          result = await bot.sendMessage(chatId, message, {
            parse_mode: "HTML",
            message_thread_id: threadId,
          });
        }

        results.push({ chatId, threadId, result });
      } catch (err) {
        console.error(`Error sending to chat ${chatId}:`, err.message);
        results.push({ chatId, threadId, error: err.message });
      }
    }
    return { results };
  },

  /**
   * Delete message from Telegram chat
   * @param {Object} options
   * @param {string} options.chatId - chat ID
   * @param {number} options.messageId - message ID to delete
   * @param {number} [options.threadId] - thread ID (optional)
   * @returns {Promise<boolean>}
   */
  async deleteMessage({ chatId, messageId, threadId }) {
    try {
      await bot.deleteMessage(chatId, messageId, {
        message_thread_id: threadId,
      });
      return true;
    } catch (error) {
      console.error(
        `Error deleting message ${messageId} from chat ${chatId}:`,
        error
      );
      throw error;
    }
  },
};
