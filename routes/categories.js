import express from 'express';
import { pool } from '../config/db.js';

const routerCategories = express.Router();

// 1. Получить все категории
routerCategories.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM categories ORDER BY id ASC'
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Получить все подкатегории для выбранной категории
routerCategories.get('/categories/:category_id/subcategories', async (req, res) => {
  try {
    const { category_id } = req.params;
    
    // Сначала проверяем существование категории
    const { rows: categoryCheck } = await pool.query(
      'SELECT id FROM categories WHERE id = $1',
      [category_id]
    );
    
    if (categoryCheck.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Получаем подкатегории
    const { rows } = await pool.query(
      'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name ASC',
      [category_id]
    );
    
    res.json({ 
      category: categoryCheck[0],
      subcategories: rows 
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default routerCategories;