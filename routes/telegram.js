// telegram.js
import bot from "../services/telegramBot.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import express from "express";
const router = express.Router();

// Маршрут для отправки сообщений в Telegram
router.post("/send", authenticateJWT, async (req, res) => {
  try {
    const {
      chat_id,
      message, // Это уже полностью отформатированное сообщение с фронтенда
      contextType,
      contextData,
      sender_id, // Этот sender_id больше не нужен для форматирования сообщения
      parse_mode = "HTML",
    } = req.body;

    if (!chat_id || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await TelegramCreationService.sendMessage({
      message: message, // Используем сообщение как есть
      chatIds: [chat_id],
      parse_mode,
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
   * @param {string} [options.parse_mode="HTML"] - parse mode (HTML or Markdown)
   * @returns {Promise<{results: Array}>}
   */
  async sendMessage({
    message,
    chatIds,
    threadIds = [],
    photos = [],
    parse_mode = "HTML",
  }) {
    if (message && message.length > 1024 && photos && photos.length > 0) {
      throw new Error("Caption exceeds 1024 characters");
    }

    const results = [];
    for (let i = 0; i < chatIds.length; ++i) {
      const chatId = chatIds[i];
      const threadId = threadIds[i] || undefined;
      try {
        let result;
        if (photos && Array.isArray(photos) && photos.length > 0) {
          if (photos.length === 1) {
            result = await bot.sendPhoto(chatId, photos[0], {
              caption: message || "",
              parse_mode,
              message_thread_id: threadId,
            });
          } else {
            const media = photos.map((photo, index) => ({
              type: "photo",
              media: photo,
              ...(index === 0 ? { caption: message || "", parse_mode } : {}),
            }));

            result = await bot.sendMediaGroup(chatId, media, {
              message_thread_id: threadId,
            });
            // result — массив объектов с message_id для каждого изображения
            result = result.map((msg, index) => ({
              message_id: msg.message_id,
              url: photos[index],
            }));
          }
        } else {
          result = await bot.sendMessage(chatId, message || "", {
            parse_mode,
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
   * Edit message text in Telegram chat
   * @param {Object} options
   * @param {string} options.chatId - chat ID
   * @param {number} options.messageId - message ID to edit
   * @param {string} options.text - new text message
   * @param {number} [options.threadId] - thread ID (optional)
   * @param {string} [options.parse_mode="HTML"] - parse mode (HTML or Markdown)
   * @returns {Promise<boolean>}
   */
  async editMessageText({
    chatId,
    messageId,
    text,
    threadId,
    parse_mode = "HTML",
  }) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode,
        message_thread_id: threadId,
      });
      return true;
    } catch (error) {
      console.error(
        `Error editing message text ${messageId} in chat ${chatId}:`,
        error.message
      );
      return false;
    }
  },

  /**
   * Edit message caption in Telegram chat
   * @param {Object} options
   * @param {string} options.chatId - chat ID
   * @param {number} options.messageId - message ID to edit
   * @param {string} options.caption - new caption text
   * @param {number} [options.threadId] - thread ID (optional)
   * @param {string} [options.parse_mode="HTML"] - parse mode (HTML or Markdown)
   * @returns {Promise<boolean>}
   */
  async editMessageCaption({
    chatId,
    messageId,
    caption,
    threadId,
    parse_mode = "HTML",
  }) {
    try {
      await bot.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode,
        message_thread_id: threadId,
      });
      return true;
    } catch (error) {
      console.error(
        `Error editing message caption ${messageId} in chat ${chatId}:`,
        error.message
      );
      return false;
    }
  },

  /**
   * Edit message media (photo) in Telegram chat
   * @param {Object} options
   * @param {string} options.chatId - chat ID
   * @param {number} options.messageId - message ID to edit
   * @param {string} options.mediaUrl - new media URL
   * @param {string} [options.caption] - new caption text (optional)
   * @param {number} [options.threadId] - thread ID (optional)
   * @param {string} [options.parse_mode="HTML"] - parse mode (HTML or Markdown)
   * @returns {Promise<boolean>}
   */
  async editMessageMedia({
    chatId,
    messageId,
    mediaUrl,
    caption,
    threadId,
    parse_mode = "HTML",
  }) {
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
      return true;
    } catch (error) {
      console.error(
        `Error editing message media ${messageId} in chat ${chatId}:`,
        error.message
      );
      return false;
    }
  },

  /**
   * Delete message from Telegram chat
   * @param {Object} options
   * @param {string} options.chatId - chat ID
   * @param {number} options.messageId - message ID to delete
   * @param {number} [options.threadId] - thread ID (optional)
   * @returns {Promise<boolean>}\
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
        error.message // Используем error.message для более чистого вывода
      );
      // Возвращаем false вместо throw error, чтобы не прерывать общий процесс,
      // но при этом сигнализировать о неудаче.
      return false;
    }
  },
};
