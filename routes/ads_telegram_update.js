import express from "express";
import { pool } from "../config/db.js";
import { TelegramCreationService } from "./telegram.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import pLimit from "p-limit";

const router = express.Router();

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

// Обновление объявления в БД
async function updateAd(ad_id, updateFields) {
  if (Object.keys(updateFields).length === 0) {
    return null; // Ничего обновлять
  }

  const params = [];
  let queryParts = [];
  let paramIndex = 1;

  const allowedFields = [
    "title",
    "content",
    "category",
    "subcategory",
    "price",
    "status",
  ];

  for (const field in updateFields) {
    if (allowedFields.includes(field)) {
      queryParts.push(`${field} = $${paramIndex}`);
      params.push(updateFields[field]);
      paramIndex++;
    }
  }

  if (queryParts.length === 0) {
    return null; // Нет разрешенных полей для обновления
  }

  queryParts.push(`updated_at = NOW()`);

  const query = `UPDATE ads SET ${queryParts.join(
    ", "
  )} WHERE id = $${paramIndex} RETURNING *`;
  params.push(ad_id);

  const { rows } = await pool.query(query, params);
  return rows[0];
}

// Обновление изображений
async function updateImages(ad_id, newImages) {
  // Получаем текущие изображения из БД
  const { rows: currentImages } = await pool.query(
    "SELECT image_url FROM ad_images WHERE ad_id = $1 ORDER BY created_at ASC",
    [ad_id]
  );

  const currentImageUrls = currentImages.map((img) => img.image_url);
  const newImageUrls = newImages
    .map((img) => img.url || img.image_url)
    .filter(Boolean);

  // Сравниваем текущие и новые URL изображений
  const currentSet = new Set(currentImageUrls);
  const newSet = new Set(newImageUrls);

  // Если наборы идентичны, изменений в изображениях нет, ничего не делаем
  if (
    currentSet.size === newSet.size &&
    [...currentSet].every((url) => newSet.has(url))
  ) {
    console.log(`Images for ad ${ad_id} are identical. No update needed.`);
    return;
  }

  // Если есть различия, продолжаем обновление
  // Удаляем все старые изображения
  await pool.query(`DELETE FROM ad_images WHERE ad_id = $1`, [ad_id]);

  // Добавляем новые изображения, если newImages не пуст
  if (Array.isArray(newImages) && newImages.length > 0) {
    for (const img of newImages) {
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
}

// Обновление сообщений в Telegram
async function updateTelegramMessages(
  ad_id,
  ad,
  messages,
  updateType = "update_text"
) {
  if (!messages.length) {
    console.log("No messages found for ad:", ad_id);
    return [];
  }

  // Группируем сообщения по чатам для более удобной обработки
  const messagesByChat = messages.reduce((acc, msg) => {
    if (!acc[msg.chat_id]) {
      acc[msg.chat_id] = {
        chat_id: msg.chat_id,
        thread_id: msg.thread_id,
        messages: [],
      };
    }
    acc[msg.chat_id].messages.push(msg);
    return acc;
  }, {});

  console.log(
    `Processing ${Object.keys(messagesByChat).length} chats for ad ${ad_id}`
  );

  const siteUrl = process.env.PUBLIC_SITE_URL || "https://test.sibroot.ru";
  const adLink = `${siteUrl}/ads/${ad_id}`;
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

  // Подготовка изображений
  const { rows: images } = await pool.query(
    "SELECT image_url FROM ad_images WHERE ad_id = $1 ORDER BY is_main DESC, created_at ASC",
    [ad_id]
  );

  const photos = images
    .map((img) => {
      let url = img.image_url;
      if (url.startsWith("/")) {
        const baseUrl =
          process.env.PUBLIC_SITE_URL || "https://api.asicredinvest.md/api-v1";
        url = `${baseUrl}${url}`;
      }
      return isValidUrl(url) ? url : null;
    })
    .filter(Boolean);

  console.log("Prepared photos:", photos);

  // Обработка сообщений
  const limit = pLimit(5);
  const results = [];

  if (updateType === "repost") {
    console.log(
      `Starting repost process for ad ${ad_id} in ${
        Object.keys(messagesByChat).length
      } chats`
    );

    // Сначала удаляем все существующие сообщения
    for (const chatInfo of Object.values(messagesByChat)) {
      try {
        // Получаем все сообщения и их медиа-группы для этого чата
        const { rows: messageInfo } = await pool.query(
          `SELECT message_id, media_group_id 
           FROM telegram_messages 
           WHERE ad_id = $1 AND chat_id = $2 
           ORDER BY media_group_id NULLS LAST, message_id ASC`,
          [ad_id, chatInfo.chat_id]
        );

        if (messageInfo.length === 0) {
          console.log(
            `No messages found to delete in chat ${chatInfo.chat_id}`
          );
          continue;
        }

        console.log(
          `Deleting ${messageInfo.length} messages in chat ${chatInfo.chat_id}`
        );

        // Удаляем все сообщения из медиа-группы
        for (const info of messageInfo) {
          const deleteResult = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatInfo.chat_id,
                message_id: info.message_id,
              }),
            }
          );

          const deleteData = await deleteResult.json();
          if (!deleteData.ok) {
            console.error(`Failed to delete message in Telegram:`, {
              chat_id: chatInfo.chat_id,
              message_id: info.message_id,
              error: deleteData.description,
            });
          } else {
            console.log(
              `Successfully deleted message ${info.message_id} in chat ${chatInfo.chat_id}`
            );
          }
        }

        // Удаляем записи из БД
        await pool.query(
          `DELETE FROM telegram_messages 
           WHERE ad_id = $1 AND chat_id = $2`,
          [ad_id, chatInfo.chat_id]
        );
        console.log(`Deleted database records for chat ${chatInfo.chat_id}`);
      } catch (err) {
        console.error(
          `Error deleting messages in chat ${chatInfo.chat_id}:`,
          err
        );
        results.push({ chat_id: chatInfo.chat_id, error: err.message });
      }
    }

    // После удаления всех старых сообщений, отправляем новые в те же чаты
    console.log("Starting to send new messages to all chats");

    const chatIds = Object.keys(messagesByChat);
    const threadIds = Object.values(messagesByChat)
      .map((chat) => chat.thread_id)
      .filter(Boolean);

    console.log(`Sending new messages to ${chatIds.length} chats:`, chatIds);
    if (threadIds.length > 0) {
      console.log(`Including ${threadIds.length} thread IDs:`, threadIds);
    }

    const sendResult = await TelegramCreationService.sendMessage({
      message: newText,
      chatIds: chatIds,
      threadIds: threadIds.length > 0 ? threadIds : [],
      photos: photos,
    });

    // Сохраняем новые сообщения в БД
    if (sendResult && Array.isArray(sendResult.results)) {
      for (const res of sendResult.results) {
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
              console.log(
                `Saved new message ${message.message_id} to database for chat ${res.chatId}`
              );
            }
          }
        }
      }
    }

    // Формируем результаты для всех чатов
    for (const chatId of chatIds) {
      results.push({
        chat_id: chatId,
        updated: true,
        reposted: true,
        old_messages_deleted: true,
      });
    }

    return results;
  }

  // Обработка других типов обновлений (update_text и keep)
  if (updateType === "update_text") {
    // Обновляем только текст в существующих сообщениях
    for (const chatInfo of Object.values(messagesByChat)) {
      try {
        const { rows: messageInfo } = await pool.query(
          `SELECT message_id, media_group_id 
           FROM telegram_messages 
           WHERE ad_id = $1 AND chat_id = $2 
           ORDER BY media_group_id NULLS LAST, message_id ASC`,
          [ad_id, chatInfo.chat_id]
        );

        if (messageInfo.length === 0) {
          console.log(`No message info found for chat ${chatInfo.chat_id}`);
          continue;
        }

        const isMediaMessage = messageInfo[0].media_group_id != null;

        if (isMediaMessage) {
          // Для медиа-сообщений обновляем текст в первом сообщении группы
          const firstMessage = messageInfo[0];
          const editResult = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageCaption`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatInfo.chat_id,
                message_id: firstMessage.message_id,
                caption: newText,
                parse_mode: "HTML",
              }),
            }
          );

          const editData = await editResult.json();
          if (!editData.ok) {
            console.error(`Failed to edit message caption in Telegram:`, {
              chat_id: chatInfo.chat_id,
              message_id: firstMessage.message_id,
              error: editData.description,
            });
            results.push({
              chat_id: chatInfo.chat_id,
              error: editData.description,
            });
            continue;
          }
        } else {
          // Для текстовых сообщений обновляем текст
          const editResult = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatInfo.chat_id,
                message_id: chatInfo.messages[0].message_id,
                text: newText,
                parse_mode: "HTML",
                disable_web_page_preview: false,
              }),
            }
          );

          const editData = await editResult.json();
          if (!editData.ok) {
            console.error(`Failed to edit message in Telegram:`, {
              chat_id: chatInfo.chat_id,
              message_id: chatInfo.messages[0].message_id,
              error: editData.description,
            });
            results.push({
              chat_id: chatInfo.chat_id,
              error: editData.description,
            });
            continue;
          }
        }

        results.push({ chat_id: chatInfo.chat_id, updated: true });
      } catch (err) {
        console.error(
          `Error updating message for chat ${chatInfo.chat_id}:`,
          err
        );
        results.push({ chat_id: chatInfo.chat_id, error: err.message });
      }
    }
  } else if (updateType === "keep") {
    console.log("Keeping existing Telegram messages as is");
    for (const chatInfo of Object.values(messagesByChat)) {
      results.push({
        chat_id: chatInfo.chat_id,
        updated: true,
        kept: true,
      });
    }
  }

  return results;
}

// Роут обновления объявления
router.put("/ads-telegram/:id", authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ad_id = parseInt(req.params.id);
    if (isNaN(ad_id)) {
      return res.status(400).json({ error: "Invalid ad ID" });
    }

    // Получаем тип обновления Telegram из тела запроса
    const telegramUpdateType = req.body.telegramUpdateType || "update_text";

    // Получаем только разрешенные поля из тела запроса
    const updateFields = {};
    const allowedFields = [
      "title",
      "content",
      "category",
      "subcategory",
      "price",
      "status",
      "images", // images will be handled separately by updateImages
    ];

    for (const field in req.body) {
      if (allowedFields.includes(field) && field !== "images") {
        updateFields[field] = req.body[field];
      }
    }

    const images = req.body.images; // Отдельно получаем изображения

    // Проверяем права доступа
    const {
      rows: [ad],
    } = await client.query("SELECT * FROM ads WHERE id = $1", [ad_id]);

    if (!ad) {
      return res.status(404).json({ error: "Ad not found" });
    }

    const user_id = req.user?.id || req.user?.user_id;
    if (!user_id || String(ad.user_id) !== String(user_id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    let updatedAd = ad; // Начинаем с текущего объявления
    // Обновляем объявление в БД, если есть поля для обновления
    if (Object.keys(updateFields).length > 0) {
      const result = await updateAd(ad_id, updateFields);
      if (result) updatedAd = result; // Используем результат обновления, если оно было
    }

    // Обновляем изображения, если они переданы в запросе
    if (images !== undefined) {
      await updateImages(ad_id, images);
    }

    // Получаем актуальные данные объявления после обновления (включая изображения)
    const {
      rows: [finalAdData],
    } = await client.query("SELECT * FROM ads WHERE id = $1", [ad_id]);
    const { rows: finalImages } = await client.query(
      "SELECT * FROM ad_images WHERE ad_id = $1 ORDER BY is_main DESC, created_at ASC",
      [ad_id]
    );
    finalAdData.images = finalImages; // Добавляем изображения к объекту объявления

    // Получаем сообщения для обновления (уже после обновления в БД)
    const { rows: messages } = await client.query(
      `SELECT chat_id, thread_id, message_id FROM telegram_messages WHERE ad_id = $1`,
      [ad_id]
    );

    // Обновляем сообщения в Telegram в соответствии с выбранным типом обновления
    let telegramResults = [];
    if (messages.length > 0) {
      telegramResults = await updateTelegramMessages(
        ad_id,
        finalAdData,
        messages,
        telegramUpdateType
      );
    }

    await client.query("COMMIT");
    res.json({
      message: "Updated",
      ad: finalAdData,
      telegram: telegramResults,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`[${new Date().toISOString()}] Error updating ad:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
