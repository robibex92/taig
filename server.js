import express from 'express';
import cors from 'cors';
import telegramRoutes from './routes/telegram.js';
import dotenv from 'dotenv';
import bot from './bot.js';
import { Pool } from 'pg'; // для PostgreSQL

dotenv.config();

const app = express();
app.use(cors()); // Разрешает запросы с фронта
app.use(express.json());

// Подключение к базе данных
const pool = new Pool({
  user: 'backend_user',
  host: '185.219.81.226',
  database: 'TAIG',
  password: 'Gjkmpjdfntkm1bpNfqubycrjujGfhrf!',
  port: 6543,
});

app.use('/api/telegram', telegramRoutes);

// Роут для получения постов
app.get('/api/posts', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM posts';
    const params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Internal server error' });
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
