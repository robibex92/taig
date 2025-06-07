import express from "express";
import bot from "../services/telegramBot.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/send", authenticateJWT, async (req, res) => {
  try {
    const { chat_id, message, parse_mode = "HTML" } = req.body;
    if (!chat_id || !message) return res.status(400).json({ error: "Missing required fields" });

    const result = await TelegramCreationService.sendMessage({ message, chatIds: [chat_id], parse_mode });
    if (result.results[0].error) throw new Error(result.results[0].error);
    res.json({ success: true, result: result.results[0] });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
});

export const TelegramCreationService = {
  async sendMessage({ message, chatIds, threadIds = [], photos = [], parse_mode = "HTML" }) {
    if (message.length > 1024 && photos.length > 0) throw new Error("Caption exceeds 1024 characters");
    const results = [];
    for (let i = 0; i < chatIds.length; ++i) {
      const chatId = chatIds[i];
      const threadId = threadIds[i] || undefined;
      try {
        let result;
        if (photos.length > 0) {
          if (photos.length === 1) {
            result = await bot.sendPhoto(chatId, photos[0], { caption: message, parse_mode, message_thread_id: threadId });
          } else {
            const media = photos.map((photo, index) => ({
              type: "photo",
              media: photo,
              ...(index === 0 ? { caption: message, parse_mode } : {})
            }));
            result = await bot.sendMediaGroup(chatId, media, { message_thread_id: threadId });
          }
        } else {
          result = await bot.sendMessage(chatId, message, { parse_mode, message_thread_id: threadId });
        }
        results.push({ chatId, threadId, result });
      } catch (err) {
        console.error(`Error sending to chat ${chatId}:`, err.message);
        results.push({ chatId, threadId, error: err.message });
      }
    }
    return { results };
  },

  async editMessageText({ chatId, messageId, text, threadId, parse_mode = "HTML" }) {
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode, message_thread_id: threadId });
      return true;
    } catch (error) {
      console.error(`Error editing message text ${messageId} in chat ${chatId}:`, error.message);
      return false;
    }
  },

  async editMessageCaption({ chatId, messageId, caption, threadId, parse_mode = "HTML" }) {
    try {
      await bot.editMessageCaption(caption, { chat_id: chatId, message_id: messageId, parse_mode, message_thread_id: threadId });
      return true;
    } catch (error) {
      console.error(`Error editing message caption ${messageId} in chat ${chatId}:`, error.message);
      return false;
    }
  },

  async editMessageMedia({ chatId, messageId, mediaUrl, caption, threadId, parse_mode = "HTML" }) {
    try {
      const media = { type: "photo", media: mediaUrl, caption, parse_mode };
      await bot.editMessageMedia(media, { chat_id: chatId, message_id: messageId, message_thread_id: threadId });
      return true;
    } catch (error) {
      console.error(`Error editing message media ${messageId} in chat ${chatId}:`, error.message);
      return false;
    }
  },

  async deleteMessage({ chatId, messageId, threadId }) {
    try {
      await bot.deleteMessage(chatId, messageId, { message_thread_id: threadId });
      return true;
    } catch (error) {
      console.error(`Error deleting message ${messageId} from chat ${chatId}:`, error.message);
      return false;
    }
  }
};

export default router;