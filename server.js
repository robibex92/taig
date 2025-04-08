import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routerPosts from './routes/posts.js';
import routerNearby from './routes/nearby.js';
import routerCars from './routes/cars.js';
import routerAds from './routes/ads.js';
import routerFaqs from './routes/faqs.js';
import routerFloorRules from './routes/floorRules.js';
import routerCategories from './routes/categories.js';
import routerAdImages from './routes/adImages.js';
import { authenticateUser, getCurrentUser, updateCurrentUser } from './controllers/user-controller.js';
import authRoutes from './routes/auth.js'; // Роуты для авторизации
import userRoutes from './routes/user.js'; // Роуты для пользователей

//import bot from './bot.js';
//import telegramRoutes from './routes/telegram.js';

// 1. Загрузка конфигурации
dotenv.config();
// 2. Инициализация приложения
const app = express();
// 4. Middleware
app.use(express.json());
app.use(cors());
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

app.post('/api/auth/telegram', authenticateUser);
app.get('/api/users/me', getCurrentUser);
app.patch('/api/users/me', updateCurrentUser);
app.use(authRoutes); // Все роуты авторизации начинаются с /api/auth
app.use(userRoutes); // Все роуты пользователей начинаются с /api/users


// 6. Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK',
      db: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      error: err.message
    });
  }
});

// Простейший тестовый endpoint
app.get('/api/test', (req, res) => {
     res.json({ message: "Hello from backend!" });
   });

// 11. Запуск сервера
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
});
