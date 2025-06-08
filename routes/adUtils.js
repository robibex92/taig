import { pool } from "../config/db.js";
import { TelegramCreationService } from "./telegram.js";
import { getTelegramChatTargets } from "../utils/telegramChatTargets.js";
import pLimit from "p-limit";

const telegramQueue = [];
let isProcessing = false;

export const queueTelegramTask = (task) => {
  telegramQueue.push(task);
  if (!isProcessing) {
    processTelegramQueue();
  }
};

async function processTelegramQueue() {
  if (telegramQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const task = telegramQueue.shift();
  try {
    await task();
  } catch (error) {
    console.error("Error processing Telegram task:", error);
  }
  setTimeout(processTelegramQueue, 100);
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export const validateAdFields = ({
  user_id,
  title,
  content,
  category,
  subcategory,
}) => {
  if (!user_id || !title || !content || !category || !subcategory) {
    throw new Error("Missing required fields");
  }
};

export const checkUserAccess = (ad, user_id) => {
  if (!ad || String(ad.user_id) !== String(user_id)) {
    throw new Error("Access denied");
  }
};

export const createAd = async ({
  user_id,
  title,
  content,
  category,
  subcategory,
  price,
  status,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO ads (user_id, title, content, category, subcategory, price, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
    [user_id, title, content, category, subcategory, price, status]
  );
  return rows[0];
};

export const updateAd = async (ad_id, updateFields) => {
  const allowedFields = [
    "title",
    "content",
    "category",
    "subcategory",
    "price",
    "status",
  ];
  const fields = Object.keys(updateFields).filter(
    (f) => allowedFields.includes(f) && updateFields[f] !== undefined
  );
  if (!fields.length) return null;

  const queryParts = fields.map((f, i) => `${f} = $${i + 1}`);
  queryParts.push(`updated_at = NOW()`);
  const params = fields.map((f) => updateFields[f]).concat(ad_id);
  const query = `UPDATE ads SET ${queryParts.join(", ")} WHERE id = $${
    fields.length + 1
  } RETURNING *`;
  const { rows } = await pool.query(query, params);
  return rows[0];
};

export const deleteAd = async (ad_id, soft = true) => {
  if (soft) {
    await pool.query(
      "UPDATE ads SET status = 'deleted', updated_at = NOW() WHERE id = $1",
      [ad_id]
    );
  } else {
    await pool.query("DELETE FROM ads WHERE id = $1", [ad_id]);
  }
  await pool.query("DELETE FROM ad_images WHERE ad_id = $1", [ad_id]);
};

export const saveImages = async (ad_id, images) => {
  if (!Array.isArray(images) || images.length === 0) return;
  for (const img of images) {
    const imageUrl = img.url || img.image_url;
    if (!isValidUrl(imageUrl)) continue;
    await pool.query(
      `INSERT INTO ad_images (ad_id, image_url, is_main, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [ad_id, imageUrl, !!img.is_main]
    );
  }
};

export const updateImages = async (ad_id, images) => {
  const { rows: currentImages } = await pool.query(
    "SELECT image_url FROM ad_images WHERE ad_id = $1 ORDER BY created_at ASC",
    [ad_id]
  );

  const newImages = images
    .map((img) => img.url || img.image_url)
    .filter(Boolean)
    .sort();

  const currentUrls = currentImages.map((img) => img.image_url);
  const hasChanges =
    currentUrls.length !== newImages.length ||
    !currentUrls.every((url) => newImages.includes(url)) ||
    !newImages.every((url) => currentUrls.includes(url));

  if (hasChanges) {
    await pool.query("DELETE FROM ad_images WHERE ad_id = $1", [ad_id]);
    await saveImages(ad_id, images);
    console.log(`Images updated for ad ${ad_id}:`, newImages);
    return true;
  }
  return false;
};

export const buildMessageText = ({
  title,
  content,
  price,
  username,
  user_id,
  ad_id,
}) => {
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://test.sibroot.ru";
  const adLink = `${siteUrl}/#/ads/${ad_id}`;
  const priceStr =
    price == null ? "💰 Цена: Не указана" : `💰 Цена: ${price} ₽`;
  const authorLink = username
    ? `👤 Автор объявления: @${escapeHtml(username)}`
    : user_id
    ? `👤 Автор объявления: [${escapeHtml(user_id)}](tg://user?id=${escapeHtml(
        user_id
      )})`
    : `👤 Автор объявления: Не определен`;
  return `📢 <b>Объявление</b>: ${escapeHtml(title)} 📢\n\n${escapeHtml(
    content
  )}\n\n${priceStr}\n\n${authorLink}\n\n🔗 <a href="${adLink}">Посмотреть объявление на сайте</a>`;
};

export const sendToTelegram = async ({
  ad_id,
  selectedChats,
  messageText,
  photos,
}) => {
  if (!selectedChats.length) return [];
  const limit = pLimit(1);
  const uniqueChats = [...new Set(selectedChats)].map((chat) =>
    chat.toUpperCase()
  ); // Нормализация и удаление дубликатов
  const chatTargets = getTelegramChatTargets(uniqueChats);
  const photosToSend = photos
    .map((img) => {
      let url = img.url || img.image_url;
      if (!url) return null;
      if (url.startsWith("/"))
        url = `${
          process.env.PUBLIC_SITE_URL || "https://api.asicredinvest.md/api-v1"
        }${url}`;
      return isValidUrl(url) ? url : null;
    })
    .filter(Boolean);

  console.log("Sending to Telegram:", {
    ad_id,
    selectedChats: uniqueChats,
    photosToSend,
    messageText,
  });

  return Promise.all(
    chatTargets.map((chat) =>
      limit(async () => {
        try {
          let result;
          const isMedia = photosToSend.length > 0;
          const mediaGroup = isMedia
            ? photosToSend.map((photo, index) => ({
                type: "photo",
                media: photo,
                ...(index === 0
                  ? { caption: messageText, parse_mode: "HTML" }
                  : {}),
              }))
            : null;

          result = await TelegramCreationService.sendMessage({
            message: !isMedia ? messageText : "",
            chatIds: [chat.chatId],
            threadIds: chat.threadId ? [chat.threadId] : [],
            photos: photosToSend,
            mediaGroup,
            parse_mode: "HTML",
          });

          if (result && Array.isArray(result.results)) {
            for (const res of result.results) {
              if (res.result && Array.isArray(res.result)) {
                let isFirst = true;
                for (const message of res.result) {
                  if (message && message.message_id) {
                    try {
                      const isMediaMessage = isMedia && !isFirst;
                      const url =
                        photosToSend[res.result.indexOf(message)] ||
                        photosToSend[0];
                      console.log("Inserting message:", {
                        ad_id,
                        chatId: res.chatId,
                        threadId: res.threadId,
                        messageId: message.message_id,
                        mediaGroupId: message.media_group_id || null,
                        isMedia: isMediaMessage,
                        url,
                      });
                      await pool.query(
                        `INSERT INTO telegram_messages (ad_id, chat_id, thread_id, message_id, media_group_id, caption, is_media, price, url_img, created_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
                        [
                          ad_id,
                          res.chatId,
                          res.threadId,
                          message.message_id,
                          message.media_group_id || null,
                          isFirst ? messageText : null,
                          isMediaMessage,
                          isFirst
                            ? (messageText.match(/Цена: (\d+)/) || [])[1] ||
                              null
                            : null,
                          [url],
                        ]
                      );
                      isFirst = false;
                    } catch (dbErr) {
                      console.error("Error inserting media message:", dbErr);
                    }
                  }
                }
              } else if (res.result?.message_id) {
                try {
                  console.log("Inserting single message:", {
                    ad_id,
                    chatId: res.chatId,
                    threadId: res.threadId,
                    messageId: res.result.message_id,
                  });
                  await pool.query(
                    `INSERT INTO telegram_messages (ad_id, chat_id, thread_id, message_id, caption, is_media, price, url_img, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                    [
                      ad_id,
                      res.chatId,
                      res.threadId,
                      res.result.message_id,
                      messageText,
                      false,
                      (messageText.match(/Цена: (\d+)/) || [])[1] || null,
                      photosToSend,
                    ]
                  );
                } catch (dbErr) {
                  console.error("Error inserting single message:", dbErr);
                }
              }
            }
          }
          return { chat: chat.chatId, ok: true };
        } catch (err) {
          if (err.message.includes("429 Too Many Requests")) {
            const retryAfter = 44;
            console.warn(
              `Rate limited for chat ${chat.chatId}. Retrying after ${retryAfter}s`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfter * 1000)
            );
            return sendToTelegram({
              ad_id,
              selectedChats: [chat.chatId],
              messageText,
              photos,
            });
          }
          console.error(`Error sending to chat ${chat.chatId}:`, err);
          return { chat: chat.chatId, ok: false, error: err.message };
        }
      })
    )
  );
};
export const updateTelegramMessages = async (
  ad_id,
  ad,
  messages,
  telegramUpdateType,
  selectedChats,
  messageText
) => {
  // Если нет сообщений и тип не "repost", ничего не делаем
  if (!messages.length && telegramUpdateType !== "repost") {
    console.log(
      `No messages to update for ad ${ad_id}, and not a repost. Skipping.`
    );
    return [];
  }

  const uniqueSelectedChats = [...new Set(selectedChats)].map((chat) =>
    chat.toUpperCase()
  );
  const chatTargets = getTelegramChatTargets(uniqueSelectedChats);

  console.log("Updating Telegram messages:", {
    ad_id,
    telegramUpdateType,
    selectedChats: uniqueSelectedChats,
    messages: messages.map((m) => ({
      chat_id: m.chat_id,
      thread_id: m.thread_id,
      message_id: m.message_id,
    })),
  });

  // Функция для проверки изменений изображений
  const hasImageChanges = async (ad_id, ad) => {
    // Логирование входных данных
    console.log(
      `[hasImageChanges] Starting for ad_id: ${ad_id}, ad.images:`,
      ad.images
    );

    if (!ad_id || isNaN(ad_id)) {
      console.error(`[hasImageChanges] Invalid ad_id: ${ad_id}`);
      return false;
    }

    try {
      // Выполняем запрос к базе данных
      const { rows: dbMessages } = await pool.query(
        `SELECT array_agg(DISTINCT TRIM(LEADING '{' FROM TRIM(TRAILING '}' FROM unnested_url))) AS url_imgs
         FROM telegram_messages, unnest(url_img) AS unnested_url
         WHERE ad_id = $1 
           AND is_media = true`,
        [Number(ad_id)]
      );

      // Логирование результата запроса
      console.log(
        `[hasImageChanges] DB query result for ad_id ${ad_id}:`,
        dbMessages
      );

      const currentUrls =
        dbMessages.length > 0 ? dbMessages[0].url_imgs || [] : [];
      const newImages = (ad.images || [])
        .map((img) => img.url || img.image_url)
        .filter(Boolean)
        .sort();

      // Логирование перед сравнением
      console.log(`[hasImageChanges] Comparing images for ad_id ${ad_id}:`, {
        currentUrls,
        newImages,
      });

      const hasChanges =
        currentUrls.length !== newImages.length ||
        !currentUrls.every((url) => newImages.includes(url)) ||
        !newImages.every((url) => currentUrls.includes(url));

      console.log(`[hasImageChanges] Image changes detected: ${hasChanges}`);
      return hasChanges;
    } catch (error) {
      console.error(`[hasImageChanges] Error for ad_id ${ad_id}:`, error);
      return false;
    }
  };

  // Логика для случая с репостом
  if (telegramUpdateType === "repost" && ad.images && ad.images.length > 0) {
    const imageChangesDetected = await hasImageChanges(ad_id, ad);
    if (imageChangesDetected) {
      console.log(`Image changes detected for ad ${ad_id}. Performing repost.`);
      const deleteResults = await deleteTelegramMessages(ad_id, messages);
      const sendResults = await sendToTelegram({
        ad_id,
        selectedChats: uniqueSelectedChats,
        messageText,
        photos: ad.images,
      });
      return [...deleteResults, ...sendResults];
    } else {
      console.log(`No image changes for ad ${ad_id}. Updating text only.`);
    }
  } else if (!ad.images || ad.images.length === 0) {
    console.log(`No images provided for ad ${ad_id}. Updating text only.`);
  }

  // Обновляем существующие сообщения, если репост не требуется
  return await updateExistingMessages(
    ad_id,
    messages,
    messageText,
    chatTargets
  );
};

async function updateExistingMessages(
  ad_id,
  messages,
  messageText,
  chatTargets
) {
  const limit = pLimit(1);
  const results = [];
  const messagesByChat = messages.reduce((acc, msg) => {
    const key = `${msg.chat_id}_${msg.thread_id || "null"}`;
    acc[key] = acc[key] || {
      chat_id: msg.chat_id,
      thread_id: msg.thread_id,
      messages: [],
    };
    acc[key].messages.push(msg);
    return acc;
  }, {});

  for (const chatInfo of Object.values(messagesByChat)) {
    await limit(async () => {
      try {
        const target = chatTargets.find(
          (ct) =>
            String(ct.chatId) === String(chatInfo.chat_id) &&
            String(ct.threadId) === String(chatInfo.thread_id || null)
        );
        if (!target) {
          console.log(
            `Skipping chat ${chatInfo.chat_id} (thread_id: ${chatInfo.thread_id}): not selected`
          );
          return;
        }

        console.log(
          `Processing chat ${chatInfo.chat_id} (thread_id: ${chatInfo.thread_id})`
        );
        const { rows: messageInfo } = await pool.query(
          `SELECT message_id, media_group_id, caption, is_media 
           FROM telegram_messages 
           WHERE ad_id = $1 AND chat_id = $2 AND (thread_id = $3 OR ($3 IS NULL AND thread_id IS NULL))
           ORDER BY is_media ASC, message_id ASC`,
          [ad_id, chatInfo.chat_id, chatInfo.thread_id]
        );

        if (!messageInfo.length) {
          console.log(
            `No messages found for chat ${chatInfo.chat_id} (thread_id: ${chatInfo.thread_id})`
          );
          return;
        }

        const isMediaGroup = messageInfo.some((m) => m.media_group_id);
        const currentCaption =
          messageInfo.find((m) => !m.is_media)?.caption || "";

        if (currentCaption === messageText) {
          console.log(
            `Skipping update for chat ${chatInfo.chat_id} (thread_id: ${chatInfo.thread_id}): caption unchanged`
          );
          results.push({
            chat_id: chatInfo.chat_id,
            thread_id: chatInfo.thread_id,
            updated: true,
            skipped: true,
            type: isMediaGroup ? "caption_unchanged" : "text_unchanged",
          });
          return;
        }

        if (isMediaGroup) {
          const firstMessage = messageInfo.find((m) => !m.is_media);
          if (firstMessage) {
            const success = await TelegramCreationService.editMessageCaption({
              chatId: chatInfo.chat_id,
              messageId: firstMessage.message_id,
              caption: messageText,
              threadId: chatInfo.thread_id,
              parse_mode: "HTML",
            });
            results.push({
              chat_id: chatInfo.chat_id,
              thread_id: chatInfo.thread_id,
              updated: success,
              type: "caption_edited",
            });
            if (success) {
              await pool.query(
                `UPDATE telegram_messages 
                 SET caption = $1, price = $2 
                 WHERE ad_id = $3 AND chat_id = $4 AND thread_id = $5 AND is_media = false`,
                [
                  messageText,
                  (messageText.match(/Цена: (\d+)/) || [])[1] || null,
                  ad_id,
                  chatInfo.chat_id,
                  chatInfo.thread_id,
                ]
              );
            }
          }
        } else {
          const firstMessage = messageInfo[0];
          const success = await TelegramCreationService.editMessageText({
            chatId: chatInfo.chat_id,
            messageId: firstMessage.message_id,
            text: messageText,
            threadId: chatInfo.thread_id,
            parse_mode: "HTML",
          });
          results.push({
            chat_id: chatInfo.chat_id,
            thread_id: chatInfo.thread_id,
            updated: success,
            type: "text_edited",
          });
          if (success) {
            await pool.query(
              `UPDATE telegram_messages 
               SET caption = $1, price = $2 
               WHERE ad_id = $3 AND chat_id = $4 AND thread_id = $5`,
              [
                messageText,
                (messageText.match(/Цена: (\d+)/) || [])[1] || null,
                ad_id,
                chatInfo.chat_id,
                chatInfo.thread_id,
              ]
            );
          }
        }
      } catch (err) {
        console.error(
          `Error updating chat ${chatInfo.chat_id} (thread_id: ${chatInfo.thread_id}):`,
          err
        );
        results.push({
          chat_id: chatInfo.chat_id,
          thread_id: chatInfo.thread_id,
          error: err.message,
        });
      }
    });
  }

  return results;
}
export const deleteTelegramMessages = async (ad_id, messages) => {
  const limit = pLimit(1);
  const results = [];
  const messagesByChat = messages.reduce((acc, msg) => {
    acc[msg.chat_id] = acc[msg.chat_id] || [];
    acc[msg.chat_id].push(msg);
    return acc;
  }, {});

  for (const chat_id of Object.keys(messagesByChat)) {
    await limit(async () => {
      try {
        for (const msg of messagesByChat[chat_id]) {
          const success = await TelegramCreationService.deleteMessage({
            chatId: msg.chat_id,
            messageId: msg.message_id,
            threadId: msg.thread_id,
          });
          results.push({
            chat_id: msg.chat_id,
            message_id: msg.message_id,
            ok: success,
          });
        }
      } catch (err) {
        console.error(`Error deleting messages in chat ${chat_id}:`, err);
        results.push({ chat_id, ok: false, error: err.message });
      }
    });
  }

  try {
    await pool.query("DELETE FROM telegram_messages WHERE ad_id = $1", [ad_id]);
    console.log(`Deleted telegram_messages for ad_id ${ad_id}`);
  } catch (dbErr) {
    console.error("Error deleting telegram_messages from DB:", dbErr);
  }

  return results;
};
