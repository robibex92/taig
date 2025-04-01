import express from 'express';
import dotenv from 'dotenv';
import bot from '../bot.js';
import { TelegramCreationService } from '../services/telegramCreationService.js';
import { deleteAnnouncementFromTelegram } from '../services/telegramDeletionService.js';
import { updateAnnouncementInTelegram } from '../services/telegramUpdateService.js';

dotenv.config(); // Загружаем переменные окружения из .env

const router = express.Router();

// Отправка сообщения
router.post('/sendMessage', async (req, res) => {
  try {
    const { chat_id, text, parse_mode, server_salt } = req.body;

    if (server_salt !== process.env.SERVER_SALT) {
      return res.status(400).json({ error: 'Неверный серверный соль' });
    }

    const result = await bot.telegram.sendMessage(chat_id, text, {
      parse_mode: parse_mode || 'HTML'
    });

    res.json({
      ok: true,
      result
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    res.status(500).json({ error: 'Ошибка при отправке сообщения в Telegram' });
  }
});

// Создание объявления
router.post('/createAnnouncement', async (req, res) => {
  try {
    const { message, chatIds, threadIds, photos, adId, userId, server_salt } = req.body;

    if (server_salt !== process.env.SERVER_SALT) {
      return res.status(400).json({ error: 'Неверный серверный соль' });
    }

    const result = await TelegramCreationService.sendMessage({
      message,
      chatIds,
      threadIds,
      photos,
      adId,
      userId
    });

    res.json(result);
  } catch (error) {
    console.error('Ошибка при создании объявления:', error);
    res.status(500).json({ error: 'Ошибка при создании объявления в Telegram' });
  }
});

// Обновление объявления
router.post('/updateAnnouncement', async (req, res) => {
  try {
    const { announcement, server_salt } = req.body;

    if (server_salt !== process.env.SERVER_SALT) {
      return res.status(400).json({ error: 'Неверный серверный соль' });
    }

    const result = await updateAnnouncementInTelegram(announcement);
    res.json(result);
  } catch (error) {
    console.error('Ошибка при обновлении объявления:', error);
    res.status(500).json({ error: 'Ошибка при обновлении объявления в Telegram' });
  }
});

// Удаление объявления
router.post('/deleteAnnouncement', async (req, res) => {
  try {
    const { announcement, server_salt } = req.body;

    if (server_salt !== process.env.SERVER_SALT) {
      return res.status(400).json({ error: 'Неверный серверный соль' });
    }

    const result = await deleteAnnouncementFromTelegram(announcement);
    res.json(result);
  } catch (error) {
    console.error('Ошибка при удалении объявления:', error);
    res.status(500).json({ error: 'Ошибка при удалении объявления в Telegram' });
  }
});

// Webhook для обработки входящих сообщений от Telegram
router.post('/webhook', (req, res) => {
  try {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Ошибка при обработке вебхука:', error);
    res.sendStatus(500);
  }
});

export default router;
