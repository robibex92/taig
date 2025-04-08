import express from 'express';
import { pool } from '../config/db.js';

const routerAds = express.Router();

// 1. Получить все объявления по статусу
routerAds.get('/ads', async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const { rows } = await pool.query(
      'SELECT * FROM ads WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Получить конкретное объявление по id
routerAds.get('/ads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM ads WHERE id = $1',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json({ data: rows[0] });
  } catch (error) {
    console.error('Error fetching ad:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Получить объявления по категории и статусу
routerAds.get('/ads/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { status = 'active' } = req.query;
    
    const { rows } = await pool.query(
      'SELECT * FROM ads WHERE category = $1 AND status = $2 ORDER BY created_at DESC',
      [category, status]
    );
    
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching ads by category:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Получить объявления по категории и подкатегории
routerAds.get('/ads/category/:category/subcategory/:subcategory', async (req, res) => {
  try {
    const { category, subcategory } = req.params;
    const { status = 'active' } = req.query;
    
    const { rows } = await pool.query(
      `SELECT * FROM ads 
       WHERE category = $1 AND subcategory = $2 AND status = $3 
       ORDER BY created_at DESC`,
      [category, subcategory, status]
    );
    
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching ads by subcategory:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Получить объявления пользователя
routerAds.get('/ads/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const { status } = req.query;
    
    let query = 'SELECT * FROM ads WHERE user_id = $1';
    const params = [user_id];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching user ads:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 6. Создать новое объявление
routerAds.post('/ads', async (req, res) => {
  try {
    const {
      user_id,
      title,
      content,
      category,
      subcategory,
      price = null,
      status = 'active'
    } = req.body;
    
    // Валидация обязательных полей
    if (!user_id || !title || !content || !category || !subcategory) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const { rows } = await pool.query(
      `INSERT INTO ads 
       (user_id, title, content, category, subcategory, price, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [user_id, title, content, category, subcategory, price, status]
    );
    
    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 7. Изменить объявление
routerAds.patch('/ads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;
    
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Динамическое построение запроса
    let query = 'UPDATE ads SET';
    const params = [];
    let paramIndex = 1;
    
    const fieldMapping = {
      title: 'title',
      content: 'content',
      status: 'status',
      category: 'category',
      subcategory: 'subcategory',
      price: 'price',
      view_count: 'view_count'
    };
    
    const updates = [];
    
    for (const [key, value] of Object.entries(updateFields)) {
      if (fieldMapping[key]) {
        updates.push(`${fieldMapping[key]} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }
    
    // Всегда обновляем updated_at
    updates.push('updated_at = NOW()');
    
    query += ' ' + updates.join(', ') + ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);
    
    const { rows } = await pool.query(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json({ data: rows[0] });
  } catch (error) {
    console.error('Error updating ad:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 8. Удалить объявление (мягкое удаление)
routerAds.delete('/ads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      `UPDATE ads SET status = 'deleted', updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json({ message: 'Ad deleted', data: rows[0] });
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default routerAds;