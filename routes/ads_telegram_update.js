import { pool } from "../config/db.js";
import { TelegramCreationService } from "./telegram.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Обновляет сообщения в Telegram для объявления с новым текстом/медиа
 * @param {Object} ad - объект объявления { id, title, content, image_url }
 * @returns {Promise<Array>} - массив результатов по каждому сообщению
 */
// --- Утилита для экранирования HTML ---
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function updateTelegramMessagesForAd(ad) {
  // 1. Получить все сообщения из telegram_messages
  const { rows: messages } = await pool.query(
    `SELECT chat_id, thread_id, message_id FROM telegram_messages WHERE ad_id = $1`,
    [ad.id]
  );
  if (!messages.length) return [];

  // 2. Сформировать новый текст
  // Формируем шаблон сообщения для редактированного объявления
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://ваш_сайт';
  const adLink = `${siteUrl}/ads/${ad.id}`;
  const priceStr = ad.price == null ? '💰 Цена: Не указана' : `💰 Цена: ${ad.price} ₽`;
  let authorLink = '';
  let username = ad.username;
  // Если username не передан в ad, пробуем получить из БД
  if (!username && ad.user_id) {
    const userRes = await pool.query('SELECT username FROM users WHERE user_id = $1', [ad.user_id]);
    if (userRes.rows.length > 0) {
      username = userRes.rows[0].username;
    }
  }
  if (username) {
    authorLink = `<a href=\"https://t.me/${username}\">${username}</a>`;
  } else {
    authorLink = `<a href=\"tg://user?id=${ad.user_id}\">${ad.user_id}</a>`;
  }
  const newText =
    `📢 <b>Объявление (исправлено)</b>: ${escapeHtml(ad.title)} 📢\n\n` +
    `${escapeHtml(ad.content)}\n\n` +
    `${priceStr}\n\n` +
    `👤 Автор объявления: ${authorLink}\n\n` +
    `🔗 <a href=\"${adLink}\">Посмотреть объявление на сайте ТУТ</a>`;

  // 3. Если есть медиа, нужно удалить и пересоздать сообщения. Если только текст — редактировать.
  const results = [];
  for (const msg of messages) {
    try {
      if (ad.image_url) {
        // 3a. Удалить старое сообщение
        await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: msg.chat_id, message_id: msg.message_id })
          }
        );
        // 3b. Отправить новое (обновлённое) сообщение с медиа
        // Формируем photos как массив объектов { source: fs.createReadStream(<путь>) }
        let photos = [];
        if (ad.image_url) {
          const filename = path.basename(ad.image_url);
          const filePath = path.join(__dirname, '../uploads', filename);
          if (fs.existsSync(filePath)) {
            photos = [{ source: fs.createReadStream(filePath) }];
          } else {
            console.warn('Файл для отправки в Telegram не найден:', filePath);
          }
        }
        const sendResult = await TelegramCreationService.sendMessage({
          message: newText,
          chatIds: [msg.chat_id],
          threadIds: msg.thread_id ? [msg.thread_id] : [],
          photos
        });
        // 3c. Обновить запись в БД
        const newMsgId = Array.isArray(sendResult?.results) && sendResult.results[0]?.result?.message_id
          ? sendResult.results[0].result.message_id
          : null;
        if (newMsgId) {
          await pool.query(
            `UPDATE telegram_messages SET message_id = $1 WHERE ad_id = $2 AND chat_id = $3`,
            [newMsgId, ad.id, msg.chat_id]
          );
        }
        results.push({ chat_id: msg.chat_id, updated: true, newMsgId });
      } else {
        // 4. Просто текст — редактировать
        const editRes = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: msg.chat_id,
              message_id: msg.message_id,
              text: newText,
              parse_mode: "HTML"
            })
          }
        );
        const editJson = await editRes.json();
        results.push({ chat_id: msg.chat_id, edited: editJson.ok });
      }
    } catch (err) {
      results.push({ chat_id: msg.chat_id, error: err.message });
    }
  }
  return results;
}
