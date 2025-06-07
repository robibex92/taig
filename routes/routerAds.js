import express from "express";
import { pool } from "../config/db.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { validateAdFields, checkUserAccess, createAd, saveImages, updateAd, updateImages, deleteAd, queueTelegramTask, buildMessageText, sendToTelegram, updateTelegramMessages, deleteTelegramMessages } from "./adUtils.js";

const routerAds = express.Router();

// Получить все объявления
routerAds.get("/api/ads", async (req, res) => {
  try {
    const { status = "active", category, subcategory, sort, order } = req.query;
    let query = "SELECT * FROM ads WHERE status = $1";
    let params = [status];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }
    if (subcategory) {
      query += ` AND subcategory = $${paramIndex++}`;
      params.push(subcategory);
    }

    const allowedSortFields = ["created_at", "price"];
    const allowedOrders = ["ASC", "DESC"];
    if (sort && allowedSortFields.includes(sort)) {
      const safeOrder = order && allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : "DESC";
      query += sort === "price" ? ` ORDER BY CAST(price AS INTEGER) ${safeOrder} NULLS LAST` : ` ORDER BY ${sort} ${safeOrder}`;
    } else {
      query += " ORDER BY created_at DESC";
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching ads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Получить объявление по ID
routerAds.get("/api/ads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM ads WHERE id = $1", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Ad not found" });

    const { rows: images } = await pool.query("SELECT * FROM ad_images WHERE ad_id = $1 ORDER BY is_main DESC, created_at ASC", [id]);
    res.json({ data: { ...rows[0], images } });
  } catch (error) {
    console.error("Error fetching ad:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Получить объявления пользователя
routerAds.get("/api/ads/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { status, sort, order } = req.query;
    let query = "SELECT * FROM ads WHERE user_id = $1";
    const params = [user_id];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const allowedSortFields = ["created_at", "price"];
    const allowedOrders = ["ASC", "DESC"];
    if (sort && allowedSortFields.includes(sort)) {
      const safeOrder = order && allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : "DESC";
      query += sort === "price" ? ` ORDER BY CAST(price AS INTEGER) ${safeOrder} NULLS LAST` : ` ORDER BY ${sort} ${safeOrder}`;
    } else {
      query += " ORDER BY created_at DESC";
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching user ads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Увеличить счетчик просмотров
routerAds.post("/api/ads/:id/view_count", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT view_count FROM ads WHERE id = $1", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Ad not found" });

    const updatedViewCount = (rows[0].view_count || 0) + 1;
    await pool.query("UPDATE ads SET view_count = $1 WHERE id = $2", [updatedViewCount, id]);
    res.json({ view_count: updatedViewCount });
  } catch (error) {
    console.error("Error updating view count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Создать объявление
routerAds.post("/api/ads", authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { user_id, title, content, category, subcategory, price, status = "active", images = [], isTelegram, selectedChats = [] } = req.body;
    const authUserId = req.user?.id || req.user?.user_id;

    if (String(user_id) !== String(authUserId)) throw new Error("User ID mismatch");
    validateAdFields({ user_id, title, content, category, subcategory });

    const ad = await createAd({ user_id, title, content, category, subcategory, price, status });
    await saveImages(ad.id, images);

    if (isTelegram && selectedChats.length > 0) {
      const messageText = buildMessageText({ title, content, price, username: req.user?.username, user_id, ad_id: ad.id });
      queueTelegramTask(() => sendToTelegram({ ad_id: ad.id, selectedChats, messageText, photos: images }));
    }

    await client.query("COMMIT");
    const { rows: imagesData } = await pool.query("SELECT * FROM ad_images WHERE ad_id = $1 ORDER BY is_main DESC, created_at ASC", [ad.id]);
    res.status(201).json({ data: { ...ad, images: imagesData } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating ad:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Обновить объявление
routerAds.patch("/api/ads/:id", authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const { title, content, category, subcategory, price, status, images, isTelegram, selectedChats = [], telegramUpdateType = "update_text" } = req.body;
    const user_id = req.user?.id || req.user?.user_id;

    const { rows: [ad] } = await pool.query("SELECT * FROM ads WHERE id = $1", [id]);
    checkUserAccess(ad, user_id);

    const updateFields = { title, content, category, subcategory, price, status };
    const updatedAd = await updateAd(id, updateFields) || ad;
    if (images !== undefined) await updateImages(id, images);

    if (isTelegram && selectedChats.length > 0) {
      const { rows: messages } = await pool.query("SELECT chat_id, thread_id, message_id FROM telegram_messages WHERE ad_id = $1", [id]);
      const messageText = buildMessageText({
        title: title || ad.title,
        content: content || ad.content,
        price: price !== undefined ? price : ad.price,
        username: req.user?.username,
        user_id,
        ad_id: id
      });
      queueTelegramTask(() => updateTelegramMessages(id, { ...updatedAd, images }, messages, telegramUpdateType, selectedChats, messageText));
    }

    await client.query("COMMIT");
    const { rows: imagesData } = await pool.query("SELECT * FROM ad_images WHERE ad_id = $1 ORDER BY is_main DESC, created_at ASC", [id]);
    res.json({ data: { ...updatedAd, images: imagesData } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating ad:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Удалить объявление
routerAds.delete("/api/ads/:id", authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const user_id = req.user?.id || req.user?.user_id;

    const { rows: [ad] } = await pool.query("SELECT * FROM ads WHERE id = $1", [id]);
    checkUserAccess(ad, user_id);

    await deleteAd(id, true); // Мягкое удаление
    const { rows: messages } = await pool.query("SELECT chat_id, thread_id, message_id FROM telegram_messages WHERE ad_id = $1", [id]);
    if (messages.length > 0) queueTelegramTask(() => deleteTelegramMessages(id, messages));

    await client.query("COMMIT");
    res.json({ message: "Ad deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting ad:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Архивировать старые объявления
routerAds.post("/api/ads/archive-old", async (req, res) => {
  try {
    const hours = 720;
    const query = `
      UPDATE ads
      SET status = 'Archived', updated_at = NOW()
      WHERE status != 'Archived'
        AND (created_at IS NOT NULL OR updated_at IS NOT NULL)
        AND EXTRACT(EPOCH FROM (NOW() - GREATEST(
          COALESCE(updated_at, '1970-01-01'),
          COALESCE(created_at, '1970-01-01')
        )))/3600 > $1
      RETURNING id, title, created_at, updated_at, status;
    `;
    const { rows } = await pool.query(query, [hours]);
    res.json({ message: `Archived ${rows.length} ads`, archive: rows });
  } catch (error) {
    console.error("Error archiving old ads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default routerAds;