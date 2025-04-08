import express from 'express';
import { pool } from '../config/db.js';

const routerNearby = express.Router(); // Уникальное имя роутера

// 1. Получить все уникальные дома
routerNearby.get('/nearby/houses', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT DISTINCT house FROM houses WHERE status = true ORDER BY house ASC'
      );
      const houses = rows.map(row => row.house);
      res.json({ data: houses });
    } catch (error) {
      console.error('Error fetching unique houses:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
// 2. Получить все уникальные подъезды для конкретного дома
  routerNearby.get('/nearby/entrances/:house', async (req, res) => {
    try {
      const { house } = req.params;
      const { rows } = await pool.query(
        'SELECT DISTINCT entrance FROM houses WHERE house = $1 AND status = true ORDER BY entrance ASC',
        [house]
      );
      const entrances = rows.map(row => row.entrance);
      res.json({ data: entrances });
    } catch (error) {
      console.error('Error fetching unique entrances:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

// 3. Получить по фильтру house, entrance, position с сортировкой по number
routerNearby.get('/nearby', async (req, res) => {
  try {
    const { house, entrance, position } = req.query;
    let query = 'SELECT * FROM houses WHERE status = true';
    const params = [];

    if (house) {
      params.push(house);
      query += ` AND house = $${params.length}`;
    }
    if (entrance) {
      params.push(entrance);
      query += ` AND entrance = $${params.length}`;
    }
    if (position) {
      params.push(position);
      query += ` AND position = $${params.length}`;
    }

    query += ' ORDER BY number ASC';

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching houses:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Получить все строки по id_telegram
routerNearby.get('/nearby/user/:id_telegram', async (req, res) => {
  try {
    const { id_telegram } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM houses WHERE id_telegram = $1 ORDER BY house, entrance, position, number',
      [id_telegram]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching user houses:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// 5. Создать/обновить запись с id_telegram
routerNearby.post('/nearby', async (req, res) => {
  try {
    const { house, entrance, number, id_telegram } = req.body;

    // Находим запись с position=1
    const { rows: existingRows } = await pool.query(
      `SELECT * FROM houses 
       WHERE house = $1 AND entrance = $2 AND number = $3 AND position = 1`,
      [house, entrance, number]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Base position not found' });
    }

    const baseRecord = existingRows[0];

    if (!baseRecord.id_telegram) {
      // Обновляем position=1 если свободен
      await pool.query(
        `UPDATE houses SET id_telegram = $1, updated_at = NOW() 
         WHERE id = $2`,
        [id_telegram, baseRecord.id]
      );
      return res.json({ 
        message: 'Updated existing position 1',
        data: { ...baseRecord, id_telegram }
      });
    } else {
      // Создаем новую запись с увеличенным position
      const { rows: maxPosition } = await pool.query(
        `SELECT MAX(position) as max_position FROM houses 
         WHERE house = $1 AND entrance = $2 AND number = $3`,
        [house, entrance, number]
      );

      const newPosition = (maxPosition[0].max_position || 0) + 1;

      const { rows: newRow } = await pool.query(
        `INSERT INTO houses 
         (house, entrance, number, position, facade_color, info, status, id_telegram, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING *`,
        [
          house,
          entrance,
          number,
          newPosition,
          baseRecord.facade_color,
          baseRecord.info,
          true,
          id_telegram
        ]
      );

      return res.status(201).json({ 
        message: 'Created new position',
        data: newRow[0]
      });
    }
  } catch (error) {
    console.error('Error updating house:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default routerNearby; // Экспорт под уникальным именем