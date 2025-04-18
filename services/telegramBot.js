import TelegramBot from 'node-telegram-bot-api';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

export default bot;
