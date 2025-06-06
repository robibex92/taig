import { pool } from "../config/db.js";
import { TelegramCreationService } from "./telegram.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

/**
 * Обновляет сообщения в Telegram для поста с новым текстом/медиа
 * @param {Object} post - объект поста { id, title, content }
 * @param {string[]} [imageUrls] - массив URL изображений (опционально)
 * @returns {Promise<Array>} - массив результатов по каждому чату/сообщению
 */
export async function updateTelegramMessagesForPost(post, imageUrls = []) {
  // 1. Получить все сообщения из telegram_messages, сгруппированные по chat_id и thread_id
  const { rows: messageGroups } = await pool.query(
    `SELECT chat_id, thread_id, array_agg(message_id ORDER BY message_id) as message_ids FROM telegram_messages WHERE post_id = $1 GROUP BY chat_id, thread_id`,
    [post.id]
  );

  if (!messageGroups.length) {
    console.log("No telegram messages found for post:", post.id);
    return [];
  }

  // 2. Сформировать новый текст
  const newText = `🚨 ${escapeHtml(
    post.title
  )} 🚨\n🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸\n${escapeHtml(post.content)}`;

  const results = [];

  for (const group of messageGroups) {
    const { chat_id, thread_id, message_ids } = group;
    // Берем только первое message_id для редактирования/удаления/отправки
    const main_message_id = message_ids[0];

    try {
      if (imageUrls && imageUrls.length > 0) {
        // Если есть изображения, удаляем старые сообщения и отправляем новую медиа-группу (или фото)

        // 3a. Удалить все старые сообщения в этой группе (чат+поток)
        for (const msg_id of message_ids) {
          try {
            // Используем fetch для удаления через API, так как telegram.js может быть не готов
            const deleteUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`;
            await fetch(deleteUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chat_id, message_id: msg_id }),
            });
          } catch (deleteError) {
            console.error(
              `Failed to delete message ${msg_id} in chat ${chat_id}:`,
              deleteError.message
            );
            // Продолжаем, даже если удаление одного сообщения не удалось
          }
        }

        // 3b. Отправить новое сообщение с медиа (или медиа-группу)
        // TelegramCreationService ожидает массив URL изображений или объектов { media: url }
        const photosToSend = imageUrls.map((url) => ({
          type: "photo",
          media: url,
        }));

        const sendResult = await TelegramCreationService.sendMessage({
          message: newText, // Используем текст как подпись для первого медиа или просто текст для текстовых сообщений
          chatIds: [chat_id],
          threadIds: thread_id ? [thread_id] : [],
          photos: photosToSend.length > 0 ? photosToSend : undefined, // Передаем photos только если они есть
        });

        // 3c. Обновить записи в БД новыми message_id
        // Так как мы удалили старые, нужно удалить их записи из БД и вставить новые
        await pool.query(
          `DELETE FROM telegram_messages WHERE post_id = $1 AND chat_id = $2 AND (thread_id IS NULL OR thread_id = $3)`,
          [post.id, chat_id, thread_id]
        );

        if (sendResult && Array.isArray(sendResult.results)) {
          for (const resItem of sendResult.results) {
            if (resItem.result && Array.isArray(resItem.result)) {
              // Для sendMediaGroup
              for (const message of resItem.result) {
                if (message && message.message_id) {
                  await pool.query(
                    `INSERT INTO telegram_messages (post_id, chat_id, thread_id, message_id, media_group_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [
                      post.id,
                      resItem.chatId,
                      resItem.threadId,
                      message.message_id,
                      message.media_group_id,
                    ]
                  );
                }
              }
            } else if (resItem.result?.message_id) {
              // Для sendPhoto (одно фото)
              await pool.query(
                `INSERT INTO telegram_messages (post_id, chat_id, thread_id, message_id, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                [
                  post.id,
                  resItem.chatId,
                  resItem.threadId,
                  resItem.result.message_id,
                ]
              );
            }
          }
        }
        results.push({ chat_id, thread_id, updated: true, sendResult });
      } else {
        // Если нет изображений, просто редактируем текст сообщения
        // Проверяем, было ли это сообщение медиа-группой изначально.
        // Если да, то просто редактировать текст может не сработать или выглядеть странно.
        // Простой editMessageText работает только для текстовых сообщений.

        // В простейшем случае пытаемся редактировать первое сообщение в группе
        const editRes = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chat_id,
              message_id: main_message_id,
              text: newText,
              parse_mode: "HTML",
            }),
          }
        );
        const editJson = await editRes.json();
        if (!editJson.ok) {
          console.error(
            `Failed to edit text message ${main_message_id} in chat ${chat_id}:`,
            editJson.description
          );
          results.push({
            chat_id,
            thread_id,
            message_id: main_message_id,
            edited: false,
            error: editJson.description,
          });
        } else {
          results.push({
            chat_id,
            thread_id,
            message_id: main_message_id,
            edited: true,
          });
        }
      }
    } catch (err) {
      console.error(
        `Error processing telegram messages for chat ${chat_id} (post ${post.id}):`,
        err
      );
      results.push({ chat_id, thread_id, error: err.message });
    }
  }

  return results;
}
