import express from 'express';
import { pool } from '../config/db.js';

const routerCars = express.Router();

// 1. Получить все машины
routerCars.get('/api/cars', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, user_id, car_number, car_model, car_brand, car_color, info FROM cars WHERE status = true ORDER BY created_at DESC'
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Получить машины по user_id
routerCars.get('/api/cars/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM cars WHERE user_id = $1 AND status = true ORDER BY created_at DESC',
      [user_id]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching user cars:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Добавить новую машину
routerCars.post('/api/cars', async (req, res) => {
  try {
    const {
      user_id,
      car_number,
      car_model,
      car_brand,
      car_color,
      info = null
    } = req.body;

    // Валидация обязательных полей
    if (!user_id || !car_number || !car_model || !car_brand || !car_color) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { rows } = await pool.query(
      `INSERT INTO cars 
       (user_id, car_number, car_model, car_brand, car_color, info, created_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), true)
       RETURNING *`,
      [user_id, car_number, car_model, car_brand, car_color, info]
    );

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error('Error adding car:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Удалить запись (мягкое удаление через status)
routerCars.delete('/api/cars/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE cars SET status = false WHERE id = $1',
      [id]
    );
    res.sendStatus(204); // No Content
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


export default routerCars;