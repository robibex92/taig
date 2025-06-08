import express from "express";
import { pool } from "../config/db.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { TelegramCreationService } from "./telegram.js";
import {
  validateAdFields,
  checkUserAccess,
  updateAd,
  updateImages,
  buildMessageText,
  queueTelegramTask,
  updateTelegramMessages,
} from "./adUtils.js";

const routerAds = express.Router();

// 1. Получить все объявления по статусу
routerAds.get("/api/ads", async (req, res) => {
  try {
    const { status = "active", category, subcategory, sort, order } = req.query;

    let query = "SELECT * FROM ads WHERE status = $1";
    let params = [status];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (subcategory) {
      query += ` AND subcategory = $${paramIndex}`;
      params.push(subcategory);
      paramIndex++;
    }

    const allowedSortFields = ["created_at", "price"];
    const allowedOrders = ["ASC", "DESC"];

    if (sort && allowedSortFields.includes(sort)) {
      const safeOrder =
        order && allowedOrders.includes(order.toUpperCase())
          ? order.toUpperCase()
          : "DESC";

      if (sort === "price") {
        query += ` ORDER BY CAST(price AS INTEGER) ${safeOrder} NULLS LAST`;
      } else {
        query += ` ORDER BY ${sort} ${safeOrder}`;
      }
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

    const { rows } = await pool.query(
      "SELECT view_count FROM ads WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Ad not found" });
    }

    const currentViewCount = rows[0].view_count || 0;
    const updatedViewCount = currentViewCount + 1;

    await pool.query("UPDATE ads SET view_count = $1 WHERE id = $2", [
      updatedViewCount,
      id,
    ]);

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

    let query = "SELECT * FROM ads WHERE user_id = $1";
    const params = [user_id];

    if (status) {
      query += " AND status = $2";
      params.push(status);
    }

    const allowedSortFields = ["created_at", "price"];
    const allowedOrders = ["ASC", "DESC"];

    if (sort && allowedSortFields.includes(sort)) {
      const safeOrder =
        order && allowedOrders.includes(order.toUpperCase())
          ? order.toUpperCase()
          : "DESC";

      if (sort === "price") {
        query += ` ORDER BY CAST(price AS INTEGER) ${safeOrder} NULLS LAST`;
      } else {
        query += ` ORDER BY ${sort} ${safeOrder}`;
      }
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

// 6. Создать новое объявление
routerAds.post("/api/ads", authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      user_id,
      title,
      content,
      category,
      subcategory,
      price = null,
      status = "active",
      images = [],
      isTelegram = false,
      selectedChats = [],
    } = req.body;

    validateAdFields({ user_id, title, content, category, subcategory });

    if (String(user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const ad = await createAd({
      user_id,
      title,
      content,
      category,
      subcategory,
      price,
      status,
    });

    if (Array.isArray(images) && images.length > 0) {
      await updateImages(ad.id, images);
    }

    if (isTelegram && selectedChats.length > 0) {
      const messageText = buildMessageText({
        title,
        content,
        price,
        username: req.user.username,
        user_id,
        ad_id: ad.id,
      });

      queueTelegramTask(async () => {
        await sendToTelegram({
          ad_id: ad.id,
          selectedChats,
          messageText,
          photos: images,
        });
      });
    }

    await client.query("COMMIT");
    res.status(201).json({ data: ad });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating ad:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  } finally {
    client.release();
  }
});

// 7. Изменить объявление
routerAds.patch("/api/ads/:id", authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const {
      user_id,
      title,
      content,
      category,
      subcategory,
      price,
      status,
      images,
      isTelegram,
      selectedChats,
      telegramUpdateType,
    } = req.body;

    if (String(user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows: ads } = await client.query(
      "SELECT * FROM ads WHERE id = $1",
      [id]
    );
    if (ads.length === 0) {
      return res.status(404).json({ error: "Ad not found" });
    }

    checkUserAccess(ads[0], user_id);

    const updateFields = {
      title,
      content,
      category,
      subcategory,
      price,
      status,
    };

    const updatedAd = await updateAd(id, updateFields);
    if (!updatedAd) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    if (Array.isArray(images)) {
      await updateImages(id, images);
    }

    if (isTelegram && selectedChats && telegramUpdateType) {
      const { rows: messages } = await client.query(
        "SELECT chat_id, message_id, thread_id, media_group_id FROM telegram_messages WHERE ad_id = $1",
        [id]
      );

      const messageText = buildMessageText({
        title: updatedAd.title,
        content: updatedAd.content,
        price: updatedAd.price,
        username: req.user.username,
        user_id,
        ad_id: id,
      });

      queueTelegramTask(async () => {
        await updateTelegramMessages(
          id,
          { ...updatedAd, images },
          messages,
          telegramUpdateType,
          selectedChats,
          messageText
        );
      });
    }

    await client.query("COMMIT");
    res.json({ data: updatedAd });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating ad:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  } finally {
    client.release();
  }
});

// 8. Удалить объявление (мягкое удаление)
routerAds.delete("/api/ads/:id", authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const user_id = req.user?.id || req.user?.user_id;

    const {
      rows: [ad],
    } = await client.query("SELECT * FROM ads WHERE id = $1", [id]);

    if (!ad) {
      return res.status(404).json({ error: "Ad not found" });
    }

    if (!user_id || String(ad.user_id) !== String(user_id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const {
      rows: [deletedAd],
    } = await client.query(
      `UPDATE ads 
       SET status = 'deleted', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    const { rows: messages } = await client.query(
      `SELECT chat_id, message_id, media_group_id 
       FROM telegram_messages 
       WHERE ad_id = $1`,
      [id]
    );

    const telegramDeleteResults = [];

    const mediaGroups = messages.reduce((acc, msg) => {
      if (msg.media_group_id) {
        if (!acc[msg.media_group_id]) {
          acc[msg.media_group_id] = [];
        }
        acc[msg.media_group_id].push(msg);
      } else {
        if (!acc.single) {
          acc.single = [];
        }
        acc.single.push(msg);
      }
      return acc;
    }, {});

    for (const [groupId, groupMessages] of Object.entries(mediaGroups)) {
      for (const msg of groupMessages) {
        try {
          console.log(
            `Attempting to delete message ${msg.message_id} from chat ${msg.chat_id}`
          );
          const deleteSuccess = await TelegramCreationService.deleteMessage({
            chatId: msg.chat_id,
            messageId: msg.message_id,
            threadId: msg.thread_id,
          });

          telegramDeleteResults.push({
            chat_id: msg.chat_id,
            message_id: msg.message_id,
            ok: deleteSuccess,
            description: deleteSuccess
              ? "Message deleted successfully"
              : "Failed to delete message",
          });
        } catch (err) {
          console.error(`Error deleting Telegram message:`, err);
          telegramDeleteResults.push({
            chat_id: msg.chat_id,
            message_id: msg.message_id,
            ok: false,
            error: err.message,
          });
        }
      }
    }

    await client.query(`DELETE FROM telegram_messages WHERE ad_id = $1`, [id]);
    await client.query(`DELETE FROM ad_images WHERE ad_id = $1`, [id]);

    await client.query("COMMIT");

    console.log(`[${new Date().toISOString()}] Ad #${id} deleted:`, {
      ad: deletedAd,
      telegramResults: telegramDeleteResults,
    });

    res.json({
      message: "Ad deleted successfully",
      ad: deletedAd,
      telegram: telegramDeleteResults,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`[${new Date().toISOString()}] Error deleting ad:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
});

// 10. Архивировать старые объявления (старше 720 часов)
routerAds.post("/api/ads/archive-old", async (req, res) => {
  try {
    const hours = 720;
    const query = `
      UPDATE ads
      SET status = 'архивед', updated_at = NOW()
      WHERE status != 'архивед'
        AND EXTRACT(EPOCH FROM (NOW() - GREATEST(
          COALESCE(updated_at, '1970-01-01'),
          COALESCE(created_at, '1970-01-01')
        )))/3600 > $1
      RETURNING id, title, created_at, updated_at, status;
    `;
    const { rows } = await pool.query(query, [hours]);
    res.json({
      message: `Архивировано ${rows.length} объявлений`,
      archive: rows,
    });
  } catch (error) {
    console.error("Error archiving old ads:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Получить сообщения Telegram для объявления
routerAds.get(
  "/api/ads/:id/telegram-messages",
  authenticateJWT,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user_id = req.user?.id || req.user?.user_id;

      // Проверяем доступ к объявлению
      const {
        rows: [ad],
      } = await pool.query("SELECT * FROM ads WHERE id = $1", [id]);
      if (!ad) {
        return res.status(404).json({ error: "Ad not found" });
      }
      checkUserAccess(ad, user_id);

      // Получаем сообщения Telegram
      const { rows: messages } = await pool.query(
        `SELECT chat_id, thread_id, message_id, media_group_id, created_at 
       FROM telegram_messages 
       WHERE ad_id = $1 
       ORDER BY created_at DESC`,
        [id]
      );

      res.json({ messages });
    } catch (error) {
      console.error("Error fetching Telegram messages:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default routerAds;
