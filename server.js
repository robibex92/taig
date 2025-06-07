import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./config/db.js";
import routerPosts from "./routes/posts.js";
import routerNearby from "./routes/nearby.js";
import routerCars from "./routes/cars.js";
import routerAds from "./routes/routerAds.js";
import routerFaqs from "./routes/faqs.js";
import routerFloorRules from "./routes/floorRules.js";
import routerCategories from "./routes/categories.js";
import routerAdImages from "./routes/adImages.js";
import uploadRouter from "./routes/upload.js";
import telegramRoutes from "./routes/telegram.js";
import authRoutes from "./routes/auth.js";
import userRoutes, { publicUserRouter } from "./routes/user.js";
import {
  authenticateUser,
  refreshAccessToken,
  updateCurrentUser,
} from "./controllers/user-controller.js";
import { authenticateJWT } from "./middlewares/authMiddleware.js";
import cron from "node-cron";
import fetch from "node-fetch";

// Загрузка конфигурации
dotenv.config();

// Инициализация приложения
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(
  cors({
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} ${req.ip} ${req.method} ${req.path}`
  );
  next();
});

// Публичные роуты
app.use(routerPosts);
app.use(routerNearby);
app.use(routerCars);
app.use(routerAds);
app.use(routerFaqs);
app.use(routerFloorRules);
app.use(routerCategories);
app.use(routerAdImages);
app.use("/api/telegram", telegramRoutes);
app.use("/api/upload", authenticateJWT, uploadRouter); // Только защищённый /api/upload
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.post("/api/auth/telegram", authenticateUser);
app.post("/api/auth/refresh", refreshAccessToken);
app.use(authRoutes);
app.use(publicUserRouter);

// Защищённые роуты
app.use(authenticateJWT);

// Роут для удаления изображения объявления
app.post("/api/ads/delete-image", async (req, res) => {
  try {
    const { id, ad_id } = req.body;
    if (!id || !ad_id) {
      return res.status(400).json({ error: "Missing id or ad_id" });
    }

    const userId = req.user?.id; // Предполагаем, что user_id из токена
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Проверяем, что объявление принадлежит текущему пользователю
    const adCheck = await pool.query("SELECT user_id FROM ads WHERE id = $1", [
      ad_id,
    ]);
    if (adCheck.rows.length === 0 || adCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Удаляем изображение из базы
    const result = await pool.query(
      "DELETE FROM ad_images WHERE id = $1 AND ad_id = $2 RETURNING id",
      [id, ad_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: error.message });
  }
});

// Роут для статуса текущего пользователя
app.get("/api/users/me/status", async (req, res) => {
  try {
    const user_id = req.user?.user_id;
    if (!user_id) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { rows } = await pool.query(
      "SELECT status FROM users WHERE user_id = $1",
      [user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ status: rows[0].status });
  } catch (error) {
    console.error("Ошибка при получении статуса пользователя:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/users/me", updateCurrentUser);
app.use(userRoutes);

// Автоматическая архивация объявлений раз в 12 часов
cron.schedule("0 */12 * * *", async () => {
  try {
    const port = process.env.PORT || 4000;
    const res = await fetch(`http://localhost:${port}/api/ads/archive-old`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    console.log(`[CRON] Архивация объявлений:`, data.message);
  } catch (err) {
    console.error("[CRON] Ошибка архивации объявлений:", err);
  }
});

// Запуск сервера
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP Server running on port ${PORT}`);
});
