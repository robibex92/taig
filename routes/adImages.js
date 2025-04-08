import express from 'express';
import { pool } from '../config/db.js';

const routerAdImages = express.Router();

// 1. Создать изображения (одно или несколько)
routerAdImages.post('/ad-images', async (req, res) => {
    try {
      const { ad_id, images } = req.body;
  
      if (!ad_id || !images || !Array.isArray(images)) {
        return res.status(400).json({ error: 'Необходимо указать ads и массив images' });
      }
  
      // Проверяем существование объявления
      const adCheck = await pool.query('SELECT id FROM ads WHERE id = $1', [ad_id]);
      if (adCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Объявление не найдено' });
      }
  
      const createdImages = [];
      
      // Для каждого изображения в массиве
      for (const image of images) {
        const { image_url, is_main = false } = image;
        
        if (!image_url) continue; // Пропускаем если нет URL
  
        // Если это главное изображение, сбрасываем флаг у других
        if (is_main) {
          await pool.query(
            'UPDATE ad_images SET is_main = false WHERE ad_id = $1',
            [ad_id]
          );
        }
  
        // Создаем новое изображение
        const { rows } = await pool.query(
          `INSERT INTO ad_images 
           (ad_id, image_url, is_main, created_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING *`,
          [ad_id, image_url, is_main]
        );
  
        createdImages.push(rows[0]);
      }
  
      res.status(201).json({ data: createdImages });
    } catch (error) {
      console.error('Ошибка при создании изображений:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

// 2. Получить все изображения для объявления
routerAdImages.get('/ad-images/:ad_id', async (req, res) => {
  try {
    const { ad_id } = req.params;
    
    const { rows } = await pool.query(
      'SELECT * FROM ad_images WHERE ad_id = $1 ORDER BY is_main DESC, created_at ASC',
      [ad_id]
    );
    
    res.json({ data: rows });
  } catch (error) {
    console.error('Ошибка при получении изображений:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Удалить изображения
routerAdImages.delete('/ad-images', async (req, res) => {
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
routerAdImages.patch('/ad-images/main', async (req, res) => {
  try {
    const { ad_id, image_id } = req.body;

    if (!ad_id || !image_id) {
      return res.status(400).json({ error: 'Необходимо указать ads и image_id' });
    }

    // Начинаем транзакцию
    await pool.query('BEGIN');

    // Сбрасываем все is_main для этого объявления
    await pool.query(
      'UPDATE ad_images SET is_main = false WHERE ad_id = $1',
      [ad_id]
    );

    // Устанавливаем is_main для выбранного изображения
    const { rows } = await pool.query(
      `UPDATE ad_images 
       SET is_main = true 
       WHERE id = $1 AND ad_id = $2
       RETURNING *`,
      [image_id, ad_id]
    );

    await pool.query('COMMIT');

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Изображение не найдено' });
    }

    res.json({ data: rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Ошибка при изменении главного изображения:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default routerAdImages;