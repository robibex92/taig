import express from 'express';
import pkg from 'pg'; // Импорт CommonJS модуля pg
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

// Роут для получения постов
router.get('/', async (req, res) => {
  console.log('Получен запрос на получение постов', {
    query: req.query,
    ip: req.ip,
    headers: req.headers
  });

  try {
    const { status } = req.query;
    let query = 'SELECT id, title, content, image_url, created_at, updated_at, status, source, marker FROM public.posts';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    console.log('Выполняем запрос:', { query, params });

    const { rows } = await pool.query(query, params);

    console.log(`Найдено ${rows.length} постов`);

    res.json(rows);
  } catch (error) {
    console.error('Ошибка при запросе к БД:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });

    res.status(500).json({ 
      error: 'Database error',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Роут для создания поста
router.post('/', async (req, res) => {
  const { title, content, status, source, marker } = req.body;

  try {
    const query = `
      INSERT INTO public.posts (title, content, status, source, marker)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const params = [title, content, status, source, marker];

    const { rows } = await pool.query(query, params);
    res.status(201).json(rows[0]); // Возвращаем созданный пост
  } catch (error) {
    console.error('Ошибка при создании поста:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

// Роут для обновления поста
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content, status, source, marker } = req.body;

  try {
    const query = `
      UPDATE public.posts
      SET title = $1, content = $2, status = $3, source = $4, marker = $5
      WHERE id = $6 RETURNING *`;
    const params = [title, content, status, source, marker, id];

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(rows[0]); // Возвращаем обновленный пост
  } catch (error) {
    console.error('Ошибка при обновлении поста:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

// Роут для удаления поста
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM public.posts WHERE id = $1 RETURNING *';
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Ошибка при удалении поста:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

export default router;