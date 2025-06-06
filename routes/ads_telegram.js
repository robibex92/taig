import express from "express";
import { pool } from "../config/db.js";
import { getTelegramChatTargets } from "../utils/telegramChatTargets.js";
import { TelegramCreationService } from "./telegram.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import pLimit from "p-limit";

const routerAdsTelegram = express.Router();

// Утилита для экранирования HTML
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Валидация URL
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Создание объявления
async function createAd({
  user_id,
  title,
  content,
  category,
  subcategory,
  price,
  status,
}) {
  const { rows } = await pool.query(
    `INSERT INTO ads (user_id, title, content, category, subcategory, price, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [user_id, title, content, category, subcategory, price, status]
  );
  return rows[0];
}

// Сохранение изображений
async function saveImages(ad_id, images) {
  if (!Array.isArray(images) || images.length === 0) return;
  for (const img of images) {
    if (!isValidUrl(img.url || img.image_url)) {
      console.error("Invalid image URL:", img.url || img.image_url);
      continue;
    }
    await pool.query(
      `INSERT INTO ad_images (ad_id, image_url, is_main, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [ad_id, img.url || img.image_url, !!img.is_main]
    );
  }
}

// Формирование текста сообщения для Telegram
function buildMessageText({ title, content, price, username, user_id, ad_id }) {
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://test.sibroot.ru";
  const adLink = `${siteUrl}/#/ads/${ad_id}`;
  const priceStr =
    price == null ? "💰 Цена: Не указана" : `💰 Цена: ${price} ₽`;
  const authorLink = username
    ? `<a href="https://t.me/${username}">${escapeHtml(username)}</a>`
    : user_id || "Неизвестный пользователь";

  return (
    `📢 <b>Объявление</b>: ${escapeHtml(title)} 📢\n\n` +
    `${escapeHtml(content)}\n\n` +
    `${priceStr}\n\n` +
    `👤 Автор объявления: ${authorLink}\n\n` +
    `🔗 <a href="${adLink}">Посмотреть объявление на сайте</a>`
  );
}

// Отправка в Telegram
async function sendToTelegram({ ad_id, selectedChats, messageText, photos }) {
  if (!Array.isArray(selectedChats) || selectedChats.length === 0) return [];
  const limit = pLimit(5); // Ограничение на 5 параллельных запросов
  const chatTargets = getTelegramChatTargets(selectedChats);
  const photosToSend = photos
    .map((img) => {
      let url = typeof img === "string" ? img : img.url || img.image_url;
      if (url.startsWith("/")) {
        const baseUrl =
          process.env.PUBLIC_SITE_URL || "https://api.asicredinvest.md/api-v1";
        url = `${baseUrl}${url}`;
      }
      return isValidUrl(url) ? url : null;
    })
    .filter(Boolean);

  return Promise.all(
    chatTargets.map((target) =>
      limit(async () => {
        try {
          let result;
          if (photosToSend.length > 0) {
            const mediaGroup = photosToSend.map((photo, index) => ({
              type: "photo",
              media: photo,
              ...(index === 0
                ? { caption: messageText, parse_mode: "HTML" }
                : {}),
            }));

            result = await TelegramCreationService.sendMessage({
              message: messageText,
              chatIds: [target.chatId],
              threadIds: target.threadId ? [target.threadId] : [],
              photos: photosToSend,
            });
          } else {
            result = await TelegramCreationService.sendMessage({
              message: messageText,
              chatIds: [target.chatId],
              threadIds: target.threadId ? [target.threadId] : [],
            });
          }

          // Сохранение сообщений в БД
          if (result && Array.isArray(result.results)) {
            for (const res of result.results) {
              if (res.result && Array.isArray(res.result)) {
                for (const message of res.result) {
                  if (message && message.message_id) {
                    await pool.query(
                      `INSERT INTO telegram_messages (ad_id, chat_id, thread_id, message_id, media_group_id, created_at)
                       VALUES ($1, $2, $3, $4, $5, NOW())`,
                      [
                        ad_id,
                        res.chatId,
                        res.threadId,
                        message.message_id,
                        message.media_group_id,
                      ]
                    );
                  }
                }
              } else if (res.result?.result?.message_id) {
                await pool.query(
                  `INSERT INTO telegram_messages (ad_id, chat_id, thread_id, message_id, created_at)
                   VALUES ($1, $2, $3, $4, NOW())`,
                  [
                    ad_id,
                    res.chatId,
                    res.threadId,
                    res.result.result.message_id,
                  ]
                );
              }
            }
          }
          return { chat: target, ok: true };
        } catch (err) {
          console.error("Error sending to Telegram:", err);
          return { chat: target, ok: false, error: err.message };
        }
      })
    )
  );
}

// Роут создания объявления
routerAdsTelegram.post(
  "/api/ads-telegram",
  authenticateJWT,
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const {
        user_id: user_id_from_body,
        title,
        content,
        category,
        subcategory,
        price = null,
        status = "active",
        selectedChats = [],
        images = [],
        isImportant = false,
      } = req.body;

      const user_id = req.user?.id || req.user?.user_id;
      if (!user_id)
        return res.status(401).json({ error: "No user_id in token" });
      if (user_id_from_body && String(user_id_from_body) !== String(user_id)) {
        return res.status(403).json({ error: "User ID mismatch" });
      }

      if (!user_id || !title || !content || !category || !subcategory) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Создание объявления
      const ad = await createAd({
        user_id,
        title,
        content,
        category,
        subcategory,
        price,
        status,
      });
      const ad_id = ad.id;

      // Сохранение изображений
      await saveImages(ad_id, images);

      // Получение имени пользователя
      let username = req.user?.username;
      if (!username) {
        const userRes = await client.query(
          "SELECT username FROM users WHERE user_id = $1",
          [user_id]
        );
        if (userRes.rows.length > 0) username = userRes.rows[0].username;
      }

      // Отправка в Telegram, если важно
      let telegramResults = [];
      if (isImportant && selectedChats.length > 0) {
        const messageText = buildMessageText({
          title,
          content,
          price,
          username,
          user_id,
          ad_id,
        });
        telegramResults = await sendToTelegram({
          ad_id,
          selectedChats,
          messageText,
          photos: images,
        });
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Created" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`[${new Date().toISOString()}] Error creating ad:`, error);
      res.sendStatus(500);
    } finally {
      client.release();
    }
  }
);

// Удаление объявления и связанных постов в Telegram
routerAdsTelegram.delete(
  "/api/ads-telegram/:id",
  authenticateJWT,
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { id } = req.params;
      const user_id = req.user?.user_id;

      // Проверяем существование объявления и права доступа
      const adResult = await client.query(
        "SELECT * FROM ads WHERE id = $1 AND user_id = $2",
        [id, user_id]
      );

      if (adResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ad not found or access denied" });
      }

      // Получаем все сообщения Telegram, связанные с объявлением
      const telegramMessages = await client.query(
        "SELECT * FROM telegram_messages WHERE ad_id = $1",
        [id]
      );

      // Удаляем сообщения из Telegram
      for (const message of telegramMessages.rows) {
        try {
          await TelegramCreationService.deleteMessage({
            chatId: message.chat_id,
            messageId: message.message_id,
            threadId: message.thread_id,
          });
        } catch (error) {
          console.error(
            `Error deleting Telegram message ${message.message_id}:`,
            error
          );
          // Продолжаем удаление даже если не удалось удалить сообщение в Telegram
        }
      }

      // Удаляем записи о сообщениях Telegram из БД
      await client.query("DELETE FROM telegram_messages WHERE ad_id = $1", [
        id,
      ]);

      // Получаем все изображения объявления
      const imagesResult = await client.query(
        "SELECT * FROM ad_images WHERE ad_id = $1",
        [id]
      );

      // Удаляем изображения из хранилища (если они хранятся локально)
      for (const image of imagesResult.rows) {
        try {
          // Здесь можно добавить логику удаления файлов, если они хранятся локально
          // Например: fs.unlinkSync(path.join(uploadDir, image.filename));
        } catch (error) {
          console.error(`Error deleting image ${image.id}:`, error);
          // Продолжаем удаление даже если не удалось удалить файл
        }
      }

      // Удаляем записи об изображениях из БД
      await client.query("DELETE FROM ad_images WHERE ad_id = $1", [id]);

      // Удаляем само объявление
      await client.query("DELETE FROM ads WHERE id = $1", [id]);

      await client.query("COMMIT");
      res.json({ message: "Ad and associated data deleted successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error deleting ad:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  }
);

export default routerAdsTelegram;
