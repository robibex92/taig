import { pool } from "../config/db.js";
import { TelegramCreationService } from "./telegram.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Обновляет сообщения в Telegram для поста с новым текстом/медиа
 * @param {Object} post - объект поста { id, title, content, image_url }
 * @returns {Promise<Array>} - массив результатов по каждому сообщению
 */
export async function updateTelegramMessagesForPost(post) {
  // 1. Получить все сообщения из telegram_messages
  const { rows: messages } = await pool.query(
    `SELECT chat_id, thread_id, message_id FROM telegram_messages WHERE post_id = $1`,
    [post.id]
  );
  if (!messages.length) return [];

  // 2. Сформировать новый текст
  const newText = `🚨 ${post.title} 🚨\n🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸\n${post.content}`;

  // 3. Если есть медиа, нужно удалить и пересоздать сообщения. Если только текст — редактировать.
  const results = [];
  for (const msg of messages) {
    try {
      if (post.image_url) {
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
        if (post.image_url) {
          if (!post.image_url.startsWith('http')) {
            const filename = path.basename(post.image_url);
            const filePath = path.join(__dirname, '../uploads', filename);
            if (fs.existsSync(filePath)) {
              photos = [{ type: 'photo', media: `attach://${filename}` }];
            } else {
              console.warn('Файл для отправки в Telegram не найден:', filePath);
            }
          } else {
            photos = [{ type: 'photo', media: post.image_url }];
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
            `UPDATE telegram_messages SET message_id = $1 WHERE post_id = $2 AND chat_id = $3`,
            [newMsgId, post.id, msg.chat_id]
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
