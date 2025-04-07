// routes/news.js
import express from 'express';
import { pool } from '../config/db.js';  // Подключение к базе данных

const router = express.Router();

// Получение всех новостей
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts');  // Запрос к базе данных
    res.json(result.rows);  // Отправляем данные в ответ
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
