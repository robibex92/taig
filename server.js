import express from 'express';
import cors from 'cors';
import telegramRoutes from './routes/telegram.js';
import postsRoutes from './routes/posts.js'; // Импортируйте новый файл маршрутов
import dotenv from 'dotenv';
import bot from './bot.js';
import pg from 'pg';       // ✅ Правильный импорт для ESM
const { Pool } = pg;

dotenv.config();

const app = express();

// настройка CORS
app.use(cors()); // Разрешает запросы с фронта
app.use(express.json());

// Middleware для логирования всех запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// Подключение к базе данных
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,  // Укажите правильное имя БД
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

// Проверка подключения к базе данных
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Successfully connected to the database');
  release();
});

// Проверка подключения к базе данных
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Логирование всех API запросов
app.use('/api', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.path}`);
  next();
});

app.use('/api/telegram', telegramRoutes); // Существующий маршрут для Telegram
app.use('/api/posts', postsRoutes); // Используйте маршруты постов

// Эндпоинт для проверки здоровья сервера
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK',
      db: 'connected',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({
      status: 'ERROR',
      db: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Обработчик для корневого пути
app.get('/', (req, res) => {
  res.json({
    status: 'API is running',
    endpoints: {
      posts: '/api/posts',
      telegram: '/api/telegram'
    }
  });
});

const PORT = process.env.PORT || 5000;

//Запускаем бота
bot.launch()
  .then(() => {
    console.log('🤖 Telegram бот успешно запущен');
  })
  .catch((error) => {
    console.error('❌ Ошибка при запуске бота:', error);
  });

// Включаем graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));


// Простейший тестовый endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: "Hello from backend!" });
});