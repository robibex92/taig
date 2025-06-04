import express from "express";
import { pool } from "../config/db.js";
import { getTelegramChatTargets } from "../utils/telegramChatTargets.js";
import { TelegramCreationService } from "./telegram.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const routerAdsTelegram = express.Router();

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

// Создание объявления с отправкой в Telegram и логированием
routerAdsTelegram.post(
  "/api/ads-telegram",
  authenticateJWT,
  async (req, res) => {
    try {
      const {
        user_id: user_id_from_body,
        title,
        content,
        category,
        subcategory,
        price = null,
        status = "active",
        selectedChats = [],
        images = [], // [{url: ...}, ...]
        isImportant = false,
      } = req.body;

      const user_id = req.user?.id || req.user?.user_id;
      if (!user_id) {
        return res.status(401).json({ error: "No user_id in token" });
      }
      if (user_id_from_body && String(user_id_from_body) !== String(user_id)) {
        return res.status(403).json({ error: "User ID mismatch" });
      }

      // Валидация обязательных полей
      if (!user_id || !title || !content || !category || !subcategory) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 1. Создать объявление и получить его id
      const { rows } = await pool.query(
        `INSERT INTO ads \
       (user_id, title, content, category, subcategory, price, status, created_at)\
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())\
       RETURNING *`,
        [user_id, title, content, category, subcategory, price, status]
      );
      const ad = rows[0];
      const ad_id = ad.id;

      // --- ВСТАВКА ИЗОБРАЖЕНИЙ ---
      if (Array.isArray(images) && images.length > 0) {
        for (let i = 0; i < images.length; ++i) {
          const img = images[i];
          await pool.query(
            `INSERT INTO ad_images (ad_id, image_url, is_main, created_at)
           VALUES ($1, $2, $3, NOW())`,
            [ad_id, img.url || img.image_url, !!img.is_main]
          );
        }
      }

      // 2. Если объявление важно и выбраны чаты, отправить и залогировать
      let telegramResults = [];
      if (
        isImportant &&
        Array.isArray(selectedChats) &&
        selectedChats.length > 0 &&
        ad_id
      ) {
        const chatTargets = getTelegramChatTargets(selectedChats);
        // Формируем шаблон сообщения для нового объявления
        const siteUrl =
          process.env.PUBLIC_SITE_URL || "https://test.sibroot.ru";
        const adLink = `${siteUrl}/ads/${ad_id}`;
        const priceStr =
          price == null ? "💰 Цена: Не указана" : `💰 Цена: ${price} ₽`;

        // Получаем информацию о пользователе
        let username = req.user?.username;
        let authorLink = "";

        // Если username не передан в req.user, пробуем получить из БД
        if (!username && user_id) {
          const userRes = await pool.query(
            "SELECT username FROM users WHERE user_id = $1",
            [user_id]
          );
          if (userRes.rows.length > 0) {
            username = userRes.rows[0].username;
          }
        }

        // Формируем ссылку на автора
        if (username) {
          authorLink = `<a href="https://t.me/${username}">${escapeHtml(
            username
          )}</a>`;
        } else if (user_id) {
          authorLink = user_id;
        } else {
          authorLink = "Неизвестный пользователь";
        }

        const messageText =
          `📢 <b>Объявление</b>: ${escapeHtml(title)} 📢\n\n` +
          `${escapeHtml(content)}\n\n` +
          `${priceStr}\n\n` +
          `👤 Автор объявления: ${authorLink}\n\n` +
          `🔗 <a href="${adLink}">Посмотреть объявление на сайте</a>`;

        // Формируем photosToSend как массив URL-ов
        const photosToSend =
          Array.isArray(images) && images.length > 0
            ? images
                .map((img, index) => {
                  let url =
                    typeof img === "string" ? img : img.url || img.image_url;

                  // Убедимся, что URL является строкой и имеет правильный формат
                  if (typeof url !== "string") {
                    console.error("Invalid URL type:", typeof url, url);
                    return null;
                  }

                  // Если URL относительный, добавим домен
                  if (url.startsWith("/")) {
                    const baseUrl =
                      process.env.PUBLIC_SITE_URL ||
                      "https://api.asicredinvest.md/api-v1";
                    url = `${baseUrl}${url}`;
                  }

                  console.log("Processing image URL:", url);
                  return url;
                })
                .filter(Boolean)
            : [];

        console.log(
          "Final photosToSend:",
          JSON.stringify(photosToSend, null, 2)
        );

        telegramResults = await Promise.all(
          chatTargets.map(async (target) => {
            try {
              console.log("Sending to chat:", target.chatId);
              let result;
              if (photosToSend.length > 0) {
                // Генерируем уникальный ID для медиа-группы
                const mediaGroupId = Date.now().toString();

                // Формируем медиа-группу для отправки
                const mediaGroup = photosToSend.map((photo, index) => ({
                  type: "photo",
                  media: photo,
                  ...(index === 0
                    ? {
                        caption: messageText,
                        parse_mode: "HTML",
                        media_group_id: mediaGroupId,
                      }
                    : {}),
                }));

                console.log(
                  "Sending media group:",
                  JSON.stringify(mediaGroup, null, 2)
                );

                // Добавляем задержку перед отправкой
                await new Promise((resolve) => setTimeout(resolve, 1500));

                // Отправляем медиа-группу
                result = await TelegramCreationService.sendMessage({
                  message: messageText,
                  chatIds: [target.chatId],
                  threadIds: target.threadId ? [target.threadId] : [],
                  photos: photosToSend,
                  mediaGroupId: mediaGroupId,
                });

                console.log(
                  "Media group send result:",
                  JSON.stringify(result, null, 2)
                );

                // Сохраняем message_id в базу данных
                if (result && Array.isArray(result.results)) {
                  for (const res of result.results) {
                    console.log(
                      "Processing result item:",
                      JSON.stringify(res, null, 2)
                    );
                    if (res.result && Array.isArray(res.result)) {
                      // Для медиа-группы сохраняем все сообщения
                      for (const message of res.result) {
                        if (message && message.message_id) {
                          console.log("Saving message to database:", {
                            ad_id,
                            chatId: res.chatId,
                            threadId: res.threadId,
                            messageId: message.message_id,
                            mediaGroupId: message.media_group_id,
                          });
                          await pool.query(
                            `INSERT INTO telegram_messages (ad_id, chat_id, thread_id, message_id, media_group_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
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
                      // Для обычного сообщения
                      console.log("Saving message to database:", {
                        ad_id,
                        chatId: res.chatId,
                        threadId: res.threadId,
                        messageId: res.result.result.message_id,
                      });
                      await pool.query(
                        `INSERT INTO telegram_messages (ad_id, chat_id, thread_id, message_id, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                        [
                          ad_id,
                          res.chatId,
                          res.threadId,
                          res.result.result.message_id,
                        ]
                      );
                    } else {
                      console.log("No message_id in result:", res);
                    }
                  }
                }
              } else {
                // Если нет фото, отправляем только текст
                console.log("Sending text-only message:", messageText);
                result = await TelegramCreationService.sendMessage({
                  message: messageText,
                  chatIds: [target.chatId],
                  threadIds: target.threadId ? [target.threadId] : [],
                });
                console.log(
                  "Text-only send result:",
                  JSON.stringify(result, null, 2)
                );
              }
              return { chat: target, ok: true };
            } catch (err) {
              console.error("Error sending to Telegram:", err);
              return { chat: target, ok: false, error: err.message };
            }
          })
        );
      }

      res.status(201).json({ message: "Created" });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Ошибка создания объявления с Telegram:`,
        error
      );
      res.sendStatus(500);
    }
  }
);

export default routerAdsTelegram;
