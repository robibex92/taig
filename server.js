import express from 'express';
import cors from 'cors';
import telegramRoutes from './routes/telegram.js';
import dotenv from 'dotenv';
import bot from './bot.js';
import { Pool } from 'pg';

dotenv.config();

const app = express();

// Подробная настройка CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Обработка OPTIONS запросов
app.options('*', cors());

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

app.use('/api/telegram', telegramRoutes);

// Роут для получения постов
app.get('/api/posts', async (req, res) => {
  console.log('Received request for posts:', {
    query: req.query,
    headers: req.headers
  });

  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM posts';
    const params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    console.log('Executing query:', query, 'with params:', params);
    
    const result = await pool.query(query, params);
    console.log('Query result:', {
      rowCount: result.rowCount,
      rows: result.rows
    });
    
    res.setHeader('Content-Type', 'application/json');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching posts:', {
      message: error.message,
      stack: error.stack,
      query: error.query,
      parameters: error.parameters
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 6543;

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/posts`);
  console.log(`Database connection: ${pool.options.host}:${pool.options.port}`);
});
