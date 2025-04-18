import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import routerPosts from './routes/posts.js';
import routerNearby from './routes/nearby.js';
import routerCars from './routes/cars.js';
import routerAds from './routes/ads.js';
import routerFaqs from './routes/faqs.js';
import routerFloorRules from './routes/floorRules.js';
import routerCategories from './routes/categories.js';
import routerAdImages from './routes/adImages.js';
import { authenticateUser, refreshAccessToken, getCurrentUser, updateCurrentUser } from './controllers/user-controller.js';
import authRoutes from './routes/auth.js'; // Роуты для авторизации
import userRoutes, { publicUserRouter } from './routes/user.js'; // Все роуты пользователей начинаются с /api/users
import { authenticateJWT } from './middlewares/authMiddleware.js';
//import bot from './bot.js';
import telegramRoutes from './routes/telegram.js';

// 1. Загрузка конфигурации
dotenv.config();
// 2. Инициализация приложения
const app = express();
// 4. Middleware
app.use(express.json());
app.use(cors());
app.use(cookieParser());
// 5. Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.ip} ${req.method} ${req.path}`);
  next();
});

// Подключение маршрутов
app.use(routerPosts);
app.use(routerNearby);
app.use(routerCars);
app.use(routerAds);
app.use(routerFaqs);
app.use(routerFloorRules);
app.use(routerCategories);
app.use(routerAdImages);
app.use('/api/telegram', telegramRoutes);


// public
app.post('/api/auth/telegram', authenticateUser);
app.post('/api/auth/refresh', refreshAccessToken);
app.use(authRoutes); // Все роуты авторизации начинаются с /api/auth
app.use(publicUserRouter);

// Импорт pool для работы с БД
import { pool } from './config/db.js';

// Protected user routes
app.use(authenticateJWT);
app.use('/uploads', express.static('uploads'));

// Защищённый роут: получение статуса текущего пользователя
app.get('/api/users/me/status', async (req, res) => {
  try {
    // user_id должен быть получен из токена авторизации!
    const user_id = req.user?.id;
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

app.get('/api/users/me', getCurrentUser);
app.patch('/api/users/me', updateCurrentUser);
app.use(userRoutes); // Все роуты пользователей начинаются с /api/users



// 11. Запуск сервера
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
});
