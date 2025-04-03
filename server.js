import express from 'express';
import cors from 'cors';
import telegramRoutes from './routes/telegram.js';
import dotenv from 'dotenv';
import bot from './bot.js';
import { Pool } from 'pg';

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
  user: 'backend_user',
  host: '185.219.81.226',
  database: 'TAIG',
  password: 'Gjkmpjdfntkm1bpNfqubycrjujGfhrf!',
  port: 6543,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
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

app.use('/api/telegram', telegramRoutes);

// Роут для получения постов
app.get('/api/posts', async (req, res) => {
  console.log('Получен запрос на получение постов', {
    query: req.query,
    ip: req.ip,
    headers: req.headers
  });

  try {
    const { status } = req.query;
    let query = 'SELECT id, title, content, image_url, created_at, updated_at, status, source, marker FROM public.posts';
    const params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    console.log('Выполняем запрос:', { query, params });
    
    const { rows } = await pool.query(query, params);
    
    console.log(`Найдено ${rows.length} постов`);
    
    res.json(rows);
  } catch (error) {
    console.error('Ошибка при запросе к БД:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
    
    res.status(500).json({ 
      error: 'Database error',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

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

// Запускаем бота
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

