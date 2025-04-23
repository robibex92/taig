import express from "express";
import { pool } from "../config/db.js";

const routerPosts = express.Router();

// Получение постов только по статусу и сортировка по дате создания
routerPosts.get("/api/posts", async (req, res) => {
  try {
    const { status = "active" } = req.query; // По умолчанию 'active'

    const { rows } = await pool.query(
      "SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC",
      [status]
    );

    res.json({ data: rows });
  } catch (error) {
    console.error("Ошибка при загрузке постов:", error);
    res.status(500).json({ error: "Не удалось загрузить посты" });
  }
});

// Создание поста
import { getTelegramChatTargets } from '../utils/telegramChatTargets.js';
import { TelegramCreationService } from './telegram.js';

routerPosts.post("/api/posts", async (req, res) => {
  try {
    console.log("POST /api/posts body:", req.body); // Логируем тело запроса
    const { title, content, image_url, status, source, marker, isImportant, selectedChats = [], photos = [] } = req.body;


    // 1. Создать пост и получить его id
    const insertResult = await pool.query(
      `INSERT INTO posts 
       (title, content, image_url, status, source, marker, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
       RETURNING id`,
      [title, content, image_url, status, source, marker]
    );
    const post_id = insertResult.rows[0]?.id;
    console.log(`[${new Date().toISOString()}] Новость создана: "${title}", post_id=${post_id}`);

    // 2. Если пост важный и выбраны чаты, отправить и залогировать
    if (isImportant && Array.isArray(selectedChats) && selectedChats.length > 0 && post_id) {
      // Получить массив {chatId, threadId}
      const chatTargets = getTelegramChatTargets(selectedChats);
      const chatIds = chatTargets.map(c => c.chatId);
      const threadIds = chatTargets.map(c => c.threadId);
      // Отправить сообщение
      const sendResults = await Promise.all(chatTargets.map(async (target, idx) => {
        try {
          let result;
          const photosToSend = (photos && photos.length > 0)
            ? photos.map(img => {
                const url = img.url || img.image_url || img;
                if (!url) return null;
                if (!url.startsWith('http')) {
                  const filename = path.basename(url);
                  const filePath = path.join(__dirname, '../uploads', filename);
                  if (fs.existsSync(filePath)) {
                    return { type: 'photo', media: `attach://${filename}` };
                  } else {
                    console.warn('Файл для отправки в Telegram не найден:', filePath);
                    return null;
                  }
                } else {
                  return { type: 'photo', media: url };
                }
              }).filter(Boolean)
            : (image_url ? [{ type: 'photo', media: image_url }] : []);
          if (photosToSend.length > 0) {
            // DEBUG: Log the result of sendMessage for media
            console.log('DEBUG: Sending media, awaiting TelegramCreationService.sendMessage...');
            result = await TelegramCreationService.sendMessage({
              message: `🚨 ${title} 🚨\n🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸\n${content}`,
              chatIds: [target.chatId],
              threadIds: target.threadId ? [target.threadId] : [],
              photos: photosToSend
            });
            console.log('DEBUG: sendMessage result for media:', JSON.stringify(result, null, 2));
            // Fix: Always check for results array and log every message_id
            if (result && Array.isArray(result.results)) {
              for (const res of result.results) {
                // sendMediaGroup: res.result.result is an array of messages, or res.result is array
                let messagesArr = Array.isArray(res.result?.result) ? res.result.result : (Array.isArray(res.result) ? res.result : null);
                if (messagesArr && Array.isArray(messagesArr)) {
                  for (const msg of messagesArr) {
                    if (msg && msg.message_id) {
                      await pool.query(
                        `INSERT INTO telegram_messages (post_id, chat_id, thread_id, message_id, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                        [post_id, res.chatId, res.threadId, msg.message_id]
                      );
                      console.log('DEBUG: Inserted telegram_messages for media', {post_id, chatId: res.chatId, threadId: res.threadId, messageId: msg.message_id});
                    } else {
                      console.log('DEBUG: No message_id in media result', msg);
                    }
                  }
                } else if (res.result && res.result.message_id) {
                  // Fallback: single message object
                  await pool.query(
                    `INSERT INTO telegram_messages (post_id, chat_id, thread_id, message_id, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                    [post_id, res.chatId, res.threadId, res.result.message_id]
                  );
                  console.log('DEBUG: Inserted telegram_messages for media (single)', {post_id, chatId: res.chatId, threadId: res.threadId, messageId: res.result.message_id});
                } else {
                  console.log('DEBUG: No message_id found in media result', res);
                }
              }
            }
          } else {
            // Просто текст
            result = await TelegramCreationService.sendMessage({
              message: `🚨 ${title} 🚨\n🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸\n${content}`,
              chatIds: [target.chatId],
              threadIds: target.threadId ? [target.threadId] : []
            });
            console.log('DEBUG: sendMessage result for text:', JSON.stringify(result, null, 2));
            // Fix: Always check for results array and log every message_id
            if (result && Array.isArray(result.results)) {
              for (const res of result.results) {
                // sendMessage: res.result.result.message_id or res.result.message_id
                let messageId = res.result?.result?.message_id || res.result?.message_id;
                if (messageId) {
                  await pool.query(
                    `INSERT INTO telegram_messages (post_id, chat_id, thread_id, message_id, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                    [post_id, res.chatId, res.threadId, messageId]
                  );
                  console.log('DEBUG: Inserted telegram_messages for text', {post_id, chatId: res.chatId, threadId: res.threadId, messageId});
                } else {
                  console.log('DEBUG: No message_id found in text result', res);
                }
              }
            }
          }
          return { chat: target, ok: true };

        } catch (err) {
          console.error('Ошибка отправки или логирования в Telegram:', err);
          return { chat: target, ok: false, error: err.message };
        }
      }));
      console.log('Результаты отправки по чатам:', sendResults);
    }

    res.status(201).json({ message: "Created", post_id }); // telegramDeleteResults больше не возвращаем
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Ошибка создания новости:`,
      error
    );
    res.sendStatus(500);
  }
});

// Редактирование поста
routerPosts.patch("/api/posts/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const { title, content, image_url, source } = req.body;

    const { rows } = await pool.query(
      `UPDATE posts
         SET title = $1,
             content = $2,
             image_url = $3,
             source = $4,
             updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [title, content, image_url, source, postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Обновить сообщения в Telegram, если они есть
    try {
      const { updateTelegramMessagesForPost } = await import('./posts_telegram_update.js');
      await updateTelegramMessagesForPost({
        id: postId,
        title,
        content,
        image_url
      });
    } catch (e) {
      console.error('Ошибка при обновлении сообщений в Telegram:', e);
    }
    res.json({ data: rows[0] });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка редактирования поста #${req.params.id}:`, error);
    res.sendStatus(500);
  }
});

// Закрытие поста (изменение статуса на deleted)
routerPosts.patch("/api/posts/:id/close", async (req, res) => {
  try {
    const postId = req.params.id;

    // 1. Find all telegram messages related to this post
    const { rows: messages } = await pool.query(
      `SELECT chat_id, message_id FROM telegram_messages WHERE post_id = $1`,
      [postId]
    );

    // 2. Attempt to delete each telegram message
    let telegramDeleteResults = [];
    for (const msg of messages) {
      try {
        // Use the Telegram API to delete the message
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`;
        const result = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: msg.chat_id, message_id: msg.message_id })
        });
        const data = await result.json();
        telegramDeleteResults.push({ chat_id: msg.chat_id, message_id: msg.message_id, ok: data.ok, description: data.description });
        if (!data.ok) {
          console.error(`[${new Date().toISOString()}] Не удалось удалить сообщение в Telegram:`, data);
        }
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Ошибка при удалении сообщения в Telegram:`, err);
        telegramDeleteResults.push({ chat_id: msg.chat_id, message_id: msg.message_id, ok: false, error: err.message });
      }
    }

    // 3. Remove telegram message records from the database
    await pool.query(
      `DELETE FROM telegram_messages WHERE post_id = $1`,
      [postId]
    );

    // 4. Update post status
    await pool.query(
      `UPDATE posts 
       SET status = 'deleted', 
           updated_at = NOW() 
       WHERE id = $1`,
      [postId]
    );

    console.log(
      `[${new Date().toISOString()}] Пост #${postId} закрыт (status=deleted). Telegram messages deleted:`, telegramDeleteResults
    );
    res.status(200).json({ ok: true }); // telegramDeleteResults больше не возвращаем
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Ошибка закрытия поста #${req.params.id}:`,
      error
    );
    res.sendStatus(500); // Internal Server Error
  }
});

export default routerPosts;
