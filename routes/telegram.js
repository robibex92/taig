import express from 'express';
import dotenv from 'dotenv';

dotenv.config(); // Загружаем переменные окружения из .env

const router = express.Router();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

router.post('/sendMessage', async (req, res) => {
  try {
    const { chat_id, text, parse_mode, server_salt } = req.body;

if(server_salt !== process.env.SERVER_SALT){
  return res.status(400).json({ error: 'Неверный серверный соль' });
}

   const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`,{
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id,
      text,
      parse_mode: parse_mode || 'MarkdownV2'
   })
  });
   const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    res.status(500).json({ error: 'Ошибка при отправке сообщения в Telegram' });
  }
});

export default router;
