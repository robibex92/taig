import express from 'express';
import bot from '../services/telegramBot.js';
import { pool } from '../config/db.js';

const router = express.Router();

// --- Утилиты ---
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function retryRequest(url, body, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      // fetch не выбрасывает ошибку на 429, только на сетевые ошибки
      if (attempt === maxRetries) return null;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}

class TelegramCreationService {
  static async sendMessage({ message, chatIds, threadIds = [], photos = [] }) {
    try {
      const sendPromises = chatIds.map(async (chatId, index) => {
        const threadId = threadIds[index];
        if (photos.length > 0) {
          const mediaGroup = photos.map((imageUrl, idx) => ({
            type: 'photo',
            media: imageUrl,
            ...(idx === 0 ? { caption: escapeHtml(message), parse_mode: 'HTML' } : {})
          }));
          const body = {
            chat_id: chatId,
            ...(threadId ? { message_thread_id: threadId } : {}),
            media: mediaGroup
          };
          const result = await retryRequest(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
            body
          );
          // нет обращения к БД
        } else {
          const body = {
            chat_id: chatId,
            text: escapeHtml(message),
            parse_mode: 'HTML',
            ...(threadId ? { message_thread_id: threadId } : {})
          };
          const result = await retryRequest(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            body
          );
        }
      });
      await Promise.all(sendPromises);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// --- Получить список сообщений по ad_id, post_id или context_id ---
router.get('/messages', async (req, res) => {
  const { ad_id, post_id, context_id } = req.query;
  if (!ad_id && !post_id && !context_id) {
    return res.status(400).json({ error: 'ad_id, post_id или context_id обязателен' });
  }
  try {
    let where = [];
    let values = [];
    if (ad_id) { where.push('ad_id = $' + (values.length + 1)); values.push(ad_id); }
    if (post_id) { where.push('post_id = $' + (values.length + 1)); values.push(post_id); }
    if (context_id) { where.push('context_id = $' + (values.length + 1)); values.push(context_id); }
    const sql = `SELECT * FROM telegram_messages WHERE ${where.join(' OR ')}`;
    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Удалить сообщение по chat_id и message_id ---
router.post('/delete', async (req, res) => {
  const { chat_id, message_id } = req.body;
  if (!chat_id || !message_id) {
    return res.status(400).json({ error: 'chat_id и message_id обязательны' });
  }
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteMessage`;
    const result = await retryRequest(url, { chat_id, message_id });
    if (result && result.ok) {
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: result?.description || 'Failed to delete' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Редактировать сообщение по chat_id и message_id ---
router.post('/edit', async (req, res) => {
  const { chat_id, message_id, new_text } = req.body;
  if (!chat_id || !message_id || !new_text) {
    return res.status(400).json({ error: 'chat_id, message_id, new_text обязательны' });
  }
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`;
    const result = await retryRequest(url, {
      chat_id,
      message_id,
      text: escapeHtml(new_text),
      parse_mode: 'HTML'
    });
    if (result && result.ok) {
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: result?.description || 'Failed to edit' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Универсальный роут для отправки сообщений по id объекта ---
router.post('/api/telegram/send', async (req, res) => {
  const { message, targetType, targetId } = req.body;
  let chat_id = null;

  try {
    if (targetType === 'car') {
      // Найти user_id владельца машины по id машины
      const car = await Car.findByPk(targetId, { include: User });
      chat_id = car?.User?.id_telegram;
    } else if (targetType === 'ad') {
      // Найти user_id автора объявления по id объявления
      const ad = await Ad.findByPk(targetId, { include: User });
      chat_id = ad?.User?.id_telegram;
    } else if (targetType === 'apartment') {
      // Найти id_telegram владельца квартиры по id квартиры
      const apt = await Apartment.findByPk(targetId, { include: User });
      chat_id = apt?.User?.id_telegram;
    }

    if (!chat_id) return res.status(400).json({ error: 'Не найден chat_id' });

    // Отправить сообщение через Telegram API
    const result = await sendTelegramMessage({ chat_id, message });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Основной роут ---
router.post('/send', async (req, res) => {
  const { chat_id, message, photos, contextType, contextData, sender_id } = req.body;
  if (!chat_id || !message) {
    return res.status(400).json({ error: 'chat_id and message are required' });
  }

  // Формируем заголовок в зависимости от contextType
  let title = 'Вам отправлено сообщение';
  if (contextType === 'announcement') {
    title += ` по объявлению "${contextData?.title || ''}"`;
  } else if (contextType === 'apartment') {
    title += ` соседу из кв. ${contextData?.number || ''}`;
  } else if (contextType === 'car') {
    title += ` по автомобилю ${contextData?.car_brand || ''} ${contextData?.car_model || ''}`;
  }

  // Собираем итоговое сообщение
  const formattedMessage = 
    `📨 ${title}:\n\n${message}\n\n👤 Сообщение от: ${sender_id || 'Неизвестно'}`;

  try {
    if (photos && Array.isArray(photos) && photos.length > 0) {
      const result = await TelegramCreationService.sendMessage({
        message: formattedMessage,
        chatIds: [chat_id],
        photos
      });
      return res.json(result);
    }
    await bot.sendMessage(chat_id, escapeHtml(formattedMessage), { parse_mode: 'HTML' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export { retryRequest, TelegramCreationService };
export default router;
