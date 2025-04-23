import express from 'express';
import { pool } from '../config/db.js';

const routerAdImages = express.Router();

// 1. Создать изображения (одно или несколько)
routerAdImages.post('/api/ad-images', async (req, res) => {
  try {
    const { ad_id, post_id, images } = req.body;
    if ((!ad_id && !post_id) || !images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Необходимо указать ad_id или post_id и массив images' });
    }

    // Проверяем существование объявления или поста
    if (ad_id) {
      const adCheck = await pool.query('SELECT id FROM ads WHERE id = $1', [ad_id]);
      if (adCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Объявление не найдено' });
      }
    } else if (post_id) {
      const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1', [post_id]);
      if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Пост не найден' });
      }
    }

    const serverUrl = req.protocol + '://' + req.get('host');
    const createdImages = [];
    for (const image of images) {
      const { image_url, is_main = false } = image;
      if (!image_url) continue;
      // Формируем полный URL, если нужно
      let fullImageUrl = image_url;
      if (image_url && !image_url.startsWith('http')) {
        fullImageUrl = serverUrl + image_url;
      }
      // Если это главное изображение, сбрасываем флаг у других
      if (is_main) {
        if (ad_id) {
          await pool.query('UPDATE ad_images SET is_main = false WHERE ad_id = $1', [ad_id]);
        } else if (post_id) {
          await pool.query('UPDATE ad_images SET is_main = false WHERE post_id = $1', [post_id]);
        }
      }
      // Создаем новое изображение
      const { rows } = await pool.query(
        `INSERT INTO ad_images 
         (ad_id, post_id, image_url, is_main, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [ad_id || null, post_id || null, fullImageUrl, is_main]
      );
      createdImages.push(rows[0]);
    }
    res.status(201).json({ data: createdImages });
  } catch (error) {
    console.error('Ошибка при создании изображений:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Получить все изображения для объявления или поста
routerAdImages.get('/api/ad-images', async (req, res) => {
  try {
    const { ad_id, post_id } = req.query;
    let rows = [];
    if (ad_id) {
      const result = await pool.query('SELECT * FROM ad_images WHERE ad_id = $1 ORDER BY is_main DESC, created_at ASC', [ad_id]);
      rows = result.rows;
    } else if (post_id) {
      const result = await pool.query('SELECT * FROM ad_images WHERE post_id = $1 ORDER BY is_main DESC, created_at ASC', [post_id]);
      rows = result.rows;
    } else {
      return res.status(400).json({ error: 'Необходимо указать ad_id или post_id' });
    }
    res.json({ images: rows });
  } catch (error) {
    console.error('Ошибка при получении изображений:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2a. Получить все изображения для объявления или поста по id (универсальный публичный роут)
routerAdImages.get('/api/ad-images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Пробуем найти по ad_id
    let result = await pool.query('SELECT * FROM ad_images WHERE ad_id = $1 ORDER BY is_main DESC, created_at ASC', [id]);
    let rows = result.rows;
    // Если не найдено, пробуем как post_id
    if (rows.length === 0) {
      result = await pool.query('SELECT * FROM ad_images WHERE post_id = $1 ORDER BY is_main DESC, created_at ASC', [id]);
      rows = result.rows;
    }
    return res.json({ images: rows });
  } catch (error) {
    console.error('Ошибка при получении изображений по id:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3a. Удалить одно изображение по id
routerAdImages.delete('/api/ad-images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Не указан id' });

    const { rowCount } = await pool.query(
      'DELETE FROM ad_images WHERE id = $1',
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Изображение не найдено' });
    }
    res.json({ message: 'Изображение удалено', deleted_count: rowCount });
  } catch (error) {
    console.error('Ошибка при удалении изображения:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Удалить изображения
routerAdImages.delete('/api/ad-images', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Необходимо указать массив ids для удаления' });
    }
    // Удаляем изображения и возвращаем количество удаленных
    const { rowCount } = await pool.query(
      'DELETE FROM ad_images WHERE id = ANY($1::int[])',
      [ids]
    );
    res.json({ 
      message: `Удалено ${rowCount} изображений`,
      deleted_count: rowCount
    });
  } catch (error) {
    console.error('Ошибка при удалении изображений:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Изменить статус is_main
routerAdImages.post('/api/ad-images/set-main/:image_id', async (req, res) => {
  const { image_id } = req.params;
  const { ad_id, post_id } = req.body;
  if (!image_id || (!ad_id && !post_id)) {
    return res.status(400).json({ error: 'Необходимо указать image_id и ad_id или post_id' });
  }
  try {
    await pool.query('BEGIN');
    if (ad_id) {
      await pool.query('UPDATE ad_images SET is_main = false WHERE ad_id = $1', [ad_id]);
      await pool.query('UPDATE ad_images SET is_main = true WHERE id = $1 AND ad_id = $2', [image_id, ad_id]);
    } else if (post_id) {
      await pool.query('UPDATE ad_images SET is_main = false WHERE post_id = $1', [post_id]);
      await pool.query('UPDATE ad_images SET is_main = true WHERE id = $1 AND post_id = $2', [image_id, post_id]);
    }
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Ошибка при изменении главного изображения:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default routerAdImages;