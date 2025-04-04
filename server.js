import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import telegramRoutes from './routes/telegram.js';
import postsRoutes from './routes/posts.js';
import bot from './bot.js';
import pg from 'pg';

const { Pool } = pg;

// 1. Загрузка конфигурации
dotenv.config();

// 2. Инициализация приложения
const app = express();

// 3. Конфигурация CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://test.sibroot.ru',
  'https://tp.sibroot.ru'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(allowed => 
      origin.startsWith(allowed.replace(/\/$/, ''))
    )) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Powered-By'],
  maxAge: 86400 // Кэширование preflight на 24 часа
};

// 4. Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 5. Дополнительные заголовки безопасности
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.some(allowed => origin.startsWith(allowed))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }
  next();
});

// 6. Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.ip} ${req.method} ${req.path}`);
  next();
});

// 7. Подключение к БД
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'taigsql',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 6543,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => console.log('New DB connection'));
pool.on('error', err => console.error('DB error:', err));

// 8. Маршруты
app.use('/api/telegram', telegramRoutes);
app.use('/api/posts', postsRoutes);

// 9. Health check
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

// 10. Тестовые endpoint'ы
app.get('/api/test-db', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        current_database() as db,
        current_user as user,
        inet_server_addr() as host,
        inet_server_port() as port
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('Database check failed:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/taigsql-data', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM users 
      ORDER BY id DESC 
      LIMIT 10
    `);
    res.json({ data: rows });
  } catch (err) {
    console.error('Query failed:', err.stack);
    res.status(500).json({ 
      error: 'Database error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 11. Запуск сервера
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
  console.log(`🛡️  CORS allowed for: ${allowedOrigins.join(', ')}`);
});

// 12. Graceful shutdown  
const shutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    pool.end();
    bot.stop();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);