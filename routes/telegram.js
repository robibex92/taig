import bot from "../services/telegramBot.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// Маршрут для отправки сообщений в Telegram
router.post("/send", authenticateJWT, async (req, res) => {
  try {
    const {
      chat_id,
      message, // Исходный текст сообщения
      contextType,
      contextData,
      parse_mode = "HTML",
    } = req.body;

    if (!chat_id || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Получаем user_id из токена
    const user_id = req.user.user_id;

    // Формируем заголовок на основе contextType и contextData
    let header = "";
    if (contextType === "announcement") {
      header = `📢 <b>Вам отправлено сообщение по объявлению "${escapeHtml(
        contextData?.title || ""
      )}"</b> 📢\n\n`;
    } else if (contextType === "car") {
      header = `🚗 <b>Вам отправлено сообщение по автомобилю ${escapeHtml(
        contextData?.car_brand || ""
      )} ${escapeHtml(contextData?.car_model || "")}</b> 🚗\n\n`;
    } else if (contextType === "apartment") {
      header = `🏠 <b>Вам отправлено сообщение по квартире ${escapeHtml(
        String(contextData?.number || "") // Приводим к строке
      )}</b> 🏠\n\n`;
    }

    // Получаем имя пользователя из базы
    let dbUsername = null;
    try {
      const result = await pool.query(
        "SELECT username FROM users WHERE user_id = $1",
        [user_id]
      );
      dbUsername = result.rows[0]?.username || null;
    } catch (error) {
      console.error(
        `[telegram/send] Error fetching username for user_id ${user_id}:`,
        error
      );
    }

    // Формируем информацию об авторе
    const authorLink =
      dbUsername && dbUsername.trim() !== ""
        ? `Сообщение от: <b>@${escapeHtml(dbUsername)}</b>`
        : user_id
        ? `Сообщение от: <a href="tg://user?id=${escapeHtml(
            user_id
          )}"><b>ID ${escapeHtml(user_id)}</b></a>`
        : `Сообщение от: <b>Не определен</b>`;

    // Финальное сообщение
    const finalMessage = `${header}${escapeHtml(message)}\n\n${authorLink}`;

    const result = await TelegramCreationService.sendMessage({
      message: finalMessage,
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

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default router;

export const TelegramCreationService = {
  async sendMessage({
    message,
    chatIds,
    threadIds = [],
    photos = [],
    mediaGroup,
    parse_mode = "HTML",
  }) {
    const results = [];
    for (let i = 0; i < chatIds.length; ++i) {
      const chatId = chatIds[i];
      const threadId = threadIds[i] || undefined;
      try {
        let result;
        if (mediaGroup && Array.isArray(mediaGroup) && mediaGroup.length > 0) {
          result = await bot.sendMediaGroup(chatId, mediaGroup, {
            message_thread_id: threadId,
          });
          result = result.map((msg) => ({
            message_id: msg.message_id,
            media_group_id: msg.media_group_id || null,
          }));
        } else if (photos && Array.isArray(photos) && photos.length > 0) {
          result = await bot.sendPhoto(chatId, photos[0], {
            caption: message,
            parse_mode,
            message_thread_id: threadId,
          });
          result = [{ message_id: result.message_id, media_group_id: null }];
        } else {
          result = await bot.sendMessage(chatId, message, {
            parse_mode,
            message_thread_id: threadId,
          });
          result = [{ message_id: result.message_id, media_group_id: null }];
        }
        results.push({ chatId, threadId, result });
      } catch (err) {
        console.error(`Error sending to chat ${chatId}:`, err.message);
        results.push({ chatId, threadId, error: err.message });
      }
    }
    return { results };
  },

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

  async deleteMessage({ chatId, messageId, threadId }) {
    try {
      await bot.deleteMessage(chatId, messageId, {
        message_thread_id: threadId,
      });
      return true;
    } catch (error) {
      console.error(
        `Error deleting message ${messageId} from chat ${chatId}:`,
        error.message
      );
      return false;
    }
  },
};
