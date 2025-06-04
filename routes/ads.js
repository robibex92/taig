import express from "express";
import { pool } from "../config/db.js";

const routerAds = express.Router();

// 1. Получить все объявления по статусу
routerAds.get("/api/ads", async (req, res) => {
  try {
    const { status = "active", category, subcategory, sort, order } = req.query;

    let query = "SELECT * FROM ads WHERE status = $1";
    let params = [status];
    let paramIndex = 2;

    // Если указана категория, добавляем фильтрацию по категории
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Если указана подкатегория, добавляем фильтрацию по подкатегории
    if (subcategory) {
      query += ` AND subcategory = $${paramIndex}`;
      params.push(subcategory);
      paramIndex++;
    }

    // Разрешенные поля для сортировки
    const allowedSortFields = ["created_at", "price"];
    const allowedOrders = ["ASC", "DESC"];

    // Добавляем сортировку
    if (sort && allowedSortFields.includes(sort)) {
      const safeOrder =
        order && allowedOrders.includes(order.toUpperCase())
          ? order.toUpperCase()
          : "DESC";

      if (sort === "price") {
        // Преобразуем price в числовой тип и обрабатываем NULL
        query += ` ORDER BY CAST(price AS INTEGER) ${safeOrder} NULLS LAST`;
      } else {
        query += ` ORDER BY ${sort} ${safeOrder}`;
      }
    } else {
      // По умолчанию сортируем по created_at DESC
      query += " ORDER BY created_at DESC";
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching ads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. Получить конкретное объявление по id
routerAds.get("/api/ads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM ads WHERE id = $1", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Ad not found" });
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error("Error fetching ad:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 9. Увеличить счетчик просмотров объявления
routerAds.post("/api/ads/:id/view_count", async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, существует ли объявление
    const { rows } = await pool.query(
      "SELECT view_count FROM ads WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Ad not found" });
    }

    // Текущее значение счетчика просмотров
    const currentViewCount = rows[0].view_count || 0;

    // Увеличиваем счетчик на 1
    const updatedViewCount = currentViewCount + 1;

    // Обновляем значение в базе данных
    await pool.query("UPDATE ads SET view_count = $1 WHERE id = $2", [
      updatedViewCount,
      id,
    ]);

    // Возвращаем обновленное значение счетчика
    res.json({ view_count: updatedViewCount });
  } catch (error) {
    console.error("Error updating view count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. Получить объявления пользователя
routerAds.get("/api/ads/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { status, sort, order } = req.query;

    // Базовый запрос для объявлений конкретного пользователя
    let query = "SELECT * FROM ads WHERE user_id = $1";
    const params = [user_id];

    // Если указан статус, добавляем фильтр по статусу
    if (status) {
      query += " AND status = $2";
      params.push(status);
    }

    // Разрешенные поля для сортировки и направления
    const allowedSortFields = ["created_at", "price"];
    const allowedOrders = ["ASC", "DESC"];

    // Добавляем сортировку
    if (sort && allowedSortFields.includes(sort)) {
      const safeOrder =
        order && allowedOrders.includes(order.toUpperCase())
          ? order.toUpperCase()
          : "DESC";

      if (sort === "price") {
        // Преобразуем price в числовой тип и обрабатываем NULL
        query += ` ORDER BY CAST(price AS INTEGER) ${safeOrder} NULLS LAST`;
      } else {
        query += ` ORDER BY ${sort} ${safeOrder}`;
      }
    } else {
      // По умолчанию сортируем по created_at DESC
      query += " ORDER BY created_at DESC";
    }

    // Выполняем запрос
    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching user ads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 6. Создать новое объявление
routerAds.post("/api/ads", async (req, res) => {
  try {
    const {
      user_id,
      title,
      content,
      category,
      subcategory,
      price = null,
      status = "active",
      images = [] // <-- добавили images
    } = req.body;

    // Валидация обязательных полей
    if (!user_id || !title || !content || !category || !subcategory) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { rows } = await pool.query(
      `INSERT INTO ads 
       (user_id, title, content, category, subcategory, price, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
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

    res.status(201).json({ data: ad });
  } catch (error) {
    console.error("Error creating ad:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 7. Изменить объявление
routerAds.patch("/api/ads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Динамическое построение запроса
    let query = "UPDATE ads SET";
    const params = [];
    let paramIndex = 1;

    const fieldMapping = {
      title: "title",
      content: "content",
      status: "status",
      category: "category",
      subcategory: "subcategory",
      price: "price",
      view_count: "view_count",
    };

    const updates = [];

    for (const [key, value] of Object.entries(updateFields)) {
      if (fieldMapping[key]) {
        updates.push(`${fieldMapping[key]} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    // Всегда обновляем updated_at
    updates.push("updated_at = NOW()");

    query +=
      " " + updates.join(", ") + ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const { rows } = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Ad not found" });
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error("Error updating ad:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 8. Удалить объявление (мягкое удаление)
routerAds.delete("/api/ads/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `UPDATE ads SET status = 'deleted', updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Ad not found" });
    }

    // --- Удаление связанных сообщений из Telegram и БД ---
    try {
      // 1. Найти все telegram сообщения по ad_id
      const { rows: messages } = await pool.query(
        `SELECT chat_id, message_id FROM telegram_messages WHERE ad_id = $1`,
        [id]
      );

      let telegramDeleteResults = [];
      for (const msg of messages) {
        try {
          // Удалить сообщение через Telegram Bot API
          const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`;
          const tgRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: msg.chat_id,
              message_id: msg.message_id
            })
          });
          const data = await tgRes.json();
          telegramDeleteResults.push({ chat_id: msg.chat_id, message_id: msg.message_id, ok: data.ok, description: data.description });
          if (!data.ok) {
            console.error(`[${new Date().toISOString()}] Не удалось удалить сообщение в Telegram:`, data);
          }
        } catch (err) {
          console.error(`[${new Date().toISOString()}] Ошибка при удалении сообщения в Telegram:`, err);
          telegramDeleteResults.push({ chat_id: msg.chat_id, message_id: msg.message_id, ok: false, error: err.message });
        }
      }
      // 2. Удалить записи из telegram_messages
      await pool.query(`DELETE FROM telegram_messages WHERE ad_id = $1`, [id]);
      console.log(`[${new Date().toISOString()}] Объявление #${id} удалено (status=deleted). Telegram messages deleted:`, telegramDeleteResults);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Ошибка при удалении telegram сообщений объявления #${id}:`, err);
    }
    res.json({ message: "Ad deleted" });
  } catch (error) {
    console.error("Error deleting ad:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 10. Архивировать старые объявления (старше 720 часов)
routerAds.post("/api/ads/archive-old", async (req, res) => {
  try {
    // 720 часов = 30 дней
    const hours = 720;
    // Получаем текущую дату (UTC)
    const now = new Date();
    // В Postgres можно сразу сравнить разницу в часах
    const query = `
      UPDATE ads
      SET status = 'архивед', updated_at = NOW()
      WHERE status != 'архивед'
        AND (created_at IS NOT NULL OR updated_at IS NOT NULL)
        AND EXTRACT(EPOCH FROM (NOW() - GREATEST(
          COALESCE(updated_at, '1970-01-01'),
          COALESCE(created_at, '1970-01-01')
        )))/3600 > $1
      RETURNING id, title, created_at, updated_at, status;
    `;
    const { rows } = await pool.query(query, [hours]);
    res.json({
      message: `Архивировано ${rows.length} объявлений`,
      archive: rows
    });
  } catch (error) {
    console.error("Error archiving old ads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default routerAds;
