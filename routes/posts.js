import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Получение постов с фильтрами
router.get('/', async (req, res) => {
  try {
    const { status, marker, source } = req.query;
    let query = 'SELECT * FROM posts WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (marker) {
      params.push(marker);
      query += ` AND marker = $${params.length}`;
    }
    if (source) {
      params.push(source);
      query += ` AND source = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    console.log('Executing query:', query, params); // Лог запроса

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Ошибка при получении постов' });
  }
});


export default router;
