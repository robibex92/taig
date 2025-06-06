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
async function updateImages(ad_id, images) {
  // Удаляем старые изображения
  await pool.query(`DELETE FROM ad_images WHERE ad_id = $1`, [ad_id]);

  // Добавляем новые
  if (Array.isArray(images) && images.length > 0) {
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
}

// Обновление сообщений в Telegram
async function updateTelegramMessages(ad_id, ad, messages) {
  if (!messages.length) {
    console.log("No messages found for ad:", ad_id);
    return [];
  }

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

  await Promise.all(
    messages.map((msg) =>
      limit(async () => {
        try {
          // Редактируем существующее сообщение
          const editResult = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: msg.chat_id,
                message_id: msg.message_id,
                text: newText,
                parse_mode: "HTML",
                disable_web_page_preview: false,
              }),
            }
          );

          const editData = await editResult.json();

          if (!editData.ok) {
            console.error(`Failed to edit message in Telegram:`, {
              chat_id: msg.chat_id,
              message_id: msg.message_id,
              error: editData.description,
            });
            results.push({ chat_id: msg.chat_id, error: editData.description });
            return;
          }

          // Если есть изображения, обновляем их
          if (photos.length > 0) {
            // Удаляем старые медиа-сообщения
            const { rows: mediaMessages } = await pool.query(
              `SELECT message_id FROM telegram_messages 
               WHERE ad_id = $1 AND chat_id = $2 AND media_group_id IS NOT NULL`,
              [ad_id, msg.chat_id]
            );

            for (const mediaMsg of mediaMessages) {
              await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: msg.chat_id,
                    message_id: mediaMsg.message_id,
                  }),
                }
              );
            }

            // Отправляем новые изображения
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
                          ad_id,
                          res.chatId,
                        ]
                      );
                    }
                  }
                }
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

// Роут обновления объявления
router.put("/ads-telegram/:id", authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ad_id = parseInt(req.params.id);
    if (isNaN(ad_id)) {
      return res.status(400).json({ error: "Invalid ad ID" });
    }

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
      // Проверяем, было ли поле images в теле запроса
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

    // Обновляем сообщения в Telegram (даже если обновился только статус)
    let telegramResults = [];
    if (messages.length > 0) {
      telegramResults = await updateTelegramMessages(
        ad_id,
        finalAdData, // Передаем актуальные данные объявления
        messages
      );
    }

    await client.query("COMMIT");
    res.json({
      message: "Updated",
      ad: finalAdData, // Возвращаем актуальные данные объявления
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
