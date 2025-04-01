import express from 'express';
import cors from 'cors';
import telegramRoutes from './routes/telegram.js';
import dotenv from 'dotenv';
import bot from './bot.js';

dotenv.config();

const app = express();
app.use(cors()); // Разрешает запросы с фронта
app.use(express.json());

app.use('/api/telegram', telegramRoutes);

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
