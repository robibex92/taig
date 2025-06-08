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
    "SELECT image_url FROM ad_images WHERE ad_id = $1",
    [ad_id]
  );
  const currentUrls = currentImages.map((img) => img.image_url).sort();
  const newUrls = images
    .map((img) => img.url || img.image_url)
    .filter(Boolean)
    .sort();
  if (JSON.stringify(currentUrls) !== JSON.stringify(newUrls)) {
    await pool.query("DELETE FROM ad_images WHERE ad_id = $1", [ad_id]);
    await saveImages(ad_id, images);
    console.log(`Images updated for ad ${ad_id}:`, newUrls);
  }
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
    ? `<a href="https://t.me/${username}">${escapeHtml(username)}</a>`
    : user_id || "Неизвестный пользователь";
  return `📢 <b>Объявление</b>: ${escapeHtml(title)} 📢\n\n${escapeHtml(
    content
  )}\n\n${priceStr}\n\n👤 Автор объявления: ${authorLink}\n\n🔗 <a href="${adLink}">Посмотреть объявление на сайте</a>`;
};

export const sendToTelegram = async ({
  ad_id,
  selectedChats,
  messageText,
  photos,
}) => {
  if (!selectedChats.length) return [];
  const limit = pLimit(1); // Уменьшен параллелизм до 1 для избежания лимитов
  const chatTargets = getTelegramChatTargets(selectedChats);
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
    selectedChats,
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
            message: messageText,
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
                      console.log("Inserting message:", {
                        ad_id,
                        chatId: res.chatId,
                        threadId: res.threadId,
                        messageId: message.message_id,
                        mediaGroupId: message.media_group_id || null,
                        isMedia: isMediaMessage,
                      });
                      await pool.query(
                        `INSERT INTO telegram_messages (ad_id, chat_id, thread_id, message_id, media_group_id, caption, is_media, price, created_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
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
                    `INSERT INTO telegram_messages (ad_id, chat_id, thread_id, message_id, caption, is_media, price, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                    [
                      ad_id,
                      res.chatId,
                      res.threadId,
                      res.result.message_id,
                      messageText,
                      false,
                      (messageText.match(/Цена: (\d+)/) || [])[1] || null,
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
            const retryAfter = 5; // Извлечь из err.response если доступно
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
  if (!messages.length && telegramUpdateType !== "repost") return [];
  const limit = pLimit(1);
  const results = [];

  console.log("Updating Telegram messages:", {
    ad_id,
    telegramUpdateType,
    selectedChats,
    messages: messages.map((m) => ({
      chat_id: m.chat_id,
      message_id: m.message_id,
    })),
  });

  if (telegramUpdateType === "repost") {
    const deleteResults = await deleteTelegramMessages(ad_id, messages);
    results.push(...deleteResults);

    const sendResults = await sendToTelegram({
      ad_id,
      selectedChats,
      messageText,
      photos: ad.images,
    });
    results.push(...sendResults);
    return results;
  }

  const messagesByChat = messages.reduce((acc, msg) => {
    acc[msg.chat_id] = acc[msg.chat_id] || {
      chat_id: msg.chat_id,
      thread_id: msg.thread_id,
      messages: [],
    };
    acc[msg.chat_id].messages.push(msg);
    return acc;
  }, {});

  const photos = (ad.images || [])
    .map((img) => {
      let url = img.image_url || img.url;
      if (!url) return null;
      if (url.startsWith("/"))
        url = `${
          process.env.PUBLIC_SITE_URL || "https://api.asicredinvest.md/api-v1"
        }${url}`;
      return isValidUrl(url) ? url : null;
    })
    .filter(Boolean);

  for (const chatInfo of Object.values(messagesByChat)) {
    await limit(async () => {
      try {
        if (!selectedChats.includes(String(chatInfo.chat_id))) {
          console.log(`Skipping chat ${chatInfo.chat_id}: not selected`);
          return;
        }

        const { rows: messageInfo } = await pool.query(
          `SELECT message_id, media_group_id, caption, is_media 
           FROM telegram_messages 
           WHERE ad_id = $1 AND chat_id = $2 
           ORDER BY is_media DESC, message_id ASC`,
          [ad_id, chatInfo.chat_id]
        );

        if (!messageInfo.length) {
          console.log(`No messages found for chat ${chatInfo.chat_id}`);
          return;
        }

        const isMediaMessage = messageInfo[0].is_media;
        const currentCaption = messageInfo[0].caption || "";

        if (
          currentCaption === messageText &&
          telegramUpdateType === "update_text"
        ) {
          console.log(
            `Skipping update for message ${messageInfo[0].message_id}: caption unchanged`
          );
          results.push({
            chat_id: chatInfo.chat_id,
            updated: true,
            skipped: true,
            type: isMediaMessage ? "caption_unchanged" : "text_unchanged",
          });
          return;
        }

        if (telegramUpdateType === "update_text") {
          let success;
          if (isMediaMessage) {
            success = await TelegramCreationService.editMessageCaption({
              chatId: chatInfo.chat_id,
              messageId: messageInfo[0].message_id,
              caption: messageText,
              threadId: chatInfo.thread_id,
              parse_mode: "HTML",
            });
            results.push({
              chat_id: chatInfo.chat_id,
              updated: success,
              type: "caption_edited",
            });
          } else {
            success = await TelegramCreationService.editMessageText({
              chatId: chatInfo.chat_id,
              messageId: messageInfo[0].message_id,
              text: messageText,
              threadId: chatInfo.thread_id,
              parse_mode: "HTML",
            });
            results.push({
              chat_id: chatInfo.chat_id,
              updated: success,
              type: "text_edited",
            });
          }
          if (success) {
            await pool.query(
              `UPDATE telegram_messages SET caption = $1, price = $2 
               WHERE ad_id = $3 AND chat_id = $4`,
              [
                messageText,
                (messageText.match(/Цена: (\d+)/) || [])[1] || null,
                ad_id,
                chatInfo.chat_id,
              ]
            );
          }
        } else if (telegramUpdateType === "keep") {
          results.push({
            chat_id: chatInfo.chat_id,
            updated: true,
            kept: true,
          });
        }
      } catch (err) {
        console.error(`Error updating chat ${chatInfo.chat_id}:`, err);
        results.push({ chat_id: chatInfo.chat_id, error: err.message });
      }
    });
  }

  const existingChats = Object.keys(messagesByChat);
  const newChats = selectedChats.filter(
    (chat) => !existingChats.includes(String(chat))
  );
  if (newChats.length > 0) {
    const newResults = await sendToTelegram({
      ad_id,
      selectedChats: newChats,
      messageText,
      photos,
    });
    results.push(...newResults);
  }

  return results;
};

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
