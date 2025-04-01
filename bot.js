import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Обработка команды /start
bot.command('start', (ctx) => {
  ctx.reply('Добро пожаловать! Бот успешно запущен.');
});

// Обработка текстовых сообщений
bot.on('text', (ctx) => {
  console.log('Получено сообщение:', ctx.message.text);
});

export default bot; 