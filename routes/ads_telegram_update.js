import { pool } from "../config/db.js";
import { TelegramCreationService } from "./telegram.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pLimit from "p-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Обновляет сообщения в Telegram для объявления с новым текстом/медиа
 * @param {Object} ad - объект объявления { id, title, content, image_url }
 * @returns {Promise<Array>} - массив результатов по каждому сообщению
 */
// --- Утилита для экранирования HTML ---
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

export async function updateTelegramMessagesForAd(ad) {
  console.log("Starting update for ad:", ad.id);

  // 1. Получить все сообщения из telegram_messages
  const { rows: messages } = await pool.query(
    `SELECT chat_id, thread_id, message_id FROM telegram_messages WHERE ad_id = $1`,
    [ad.id]
  );

  if (!messages.length) {
    console.log("No messages found for ad:", ad.id);
    return [];
  }

  // 2. Сформировать новый текст
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://test.sibroot.ru";
  const adLink = `${siteUrl}/ads/${ad.id}`;
  const priceStr =
    ad.price == null ? "💰 Цена: Не указана" : `💰 Цена: ${ad.price} ₽`;

  // Получаем информацию о пользователе
  let username = ad.username;
  if (!username && ad.user_id) {
    const userRes = await pool.query(
      "SELECT username FROM users WHERE user_id = $1",
      [ad.user_id]
    );
    if (userRes.rows.length > 0) {
      username = userRes.rows[0].username;
    }
  }

  const authorLink = username
    ? `<a href="https://t.me/${username}">${escapeHtml(username)}</a>`
    : ad.user_id || "Неизвестный пользователь";

  const newText =
    `📢 <b>Объявление (исправлено)</b>: ${escapeHtml(ad.title)} 📢\n\n` +
    `${escapeHtml(ad.content)}\n\n` +
    `${priceStr}\n\n` +
    `👤 Автор объявления: ${authorLink}\n\n` +
    `🔗 <a href="${adLink}">Посмотреть объявление на сайте</a>`;

  // 3. Подготовка изображений
  let photos = [];
  if (ad.image_url) {
    let url =
      typeof ad.image_url === "string"
        ? ad.image_url
        : ad.image_url.url || ad.image_url.image_url;

    if (typeof url === "string") {
      if (url.startsWith("/")) {
        const baseUrl =
          process.env.PUBLIC_SITE_URL || "https://api.asicredinvest.md/api-v1";
        url = `${baseUrl}${url}`;
      }
      if (isValidUrl(url)) {
        photos = [url];
      }
    }
  }

  console.log("Prepared photos:", photos);

  // 4. Обработка сообщений
  const limit = pLimit(5); // Ограничение на 5 параллельных запросов
  const results = [];

  await Promise.all(
    messages.map((msg) =>
      limit(async () => {
        try {
          // Удаляем старое сообщение
          await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: msg.chat_id,
                message_id: msg.message_id,
              }),
            }
          );

          // Добавляем задержку перед отправкой нового сообщения
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // Отправляем новое сообщение
          const sendResult = await TelegramCreationService.sendMessage({
            message: newText,
            chatIds: [msg.chat_id],
            threadIds: msg.thread_id ? [msg.thread_id] : [],
            photos: photos,
          });

          // Обновляем записи в БД
          if (sendResult && Array.isArray(sendResult.results)) {
            for (const res of sendResult.results) {
              if (res.result && Array.isArray(res.result)) {
                // Для медиа-группы
                for (const message of res.result) {
                  if (message && message.message_id) {
                    await pool.query(
                      `UPDATE telegram_messages 
                       SET message_id = $1, media_group_id = $2 
                       WHERE ad_id = $3 AND chat_id = $4`,
                      [
                        message.message_id,
                        message.media_group_id,
                        ad.id,
                        res.chatId,
                      ]
                    );
                  }
                }
              } else if (res.result?.result?.message_id) {
                // Для обычного сообщения
                await pool.query(
                  `UPDATE telegram_messages 
                   SET message_id = $1 
                   WHERE ad_id = $2 AND chat_id = $3`,
                  [res.result.result.message_id, ad.id, res.chatId]
                );
              }
            }
          }

          results.push({ chat_id: msg.chat_id, updated: true });
        } catch (err) {
          console.error(`Error updating message for chat ${msg.chat_id}:`, err);
          results.push({ chat_id: msg.chat_id, error: err.message });
        }
      })
    )
  );

  return results;
}
