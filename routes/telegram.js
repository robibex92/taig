import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config(); // Загружаем переменные окружения из .env

const router = express.Router();
const TELEGRAM_BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

router.post('/sendMessage', async (req, res) => {
  try {
    const { chat_id, text, parse_mode } = req.body;
    
    const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id,
      text,
      parse_mode: parse_mode || 'MarkdownV2'
    });

    res.json(response.data);
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    res.status(500).json({ error: 'Ошибка при отправке сообщения в Telegram' });
  }
});

export default router;
