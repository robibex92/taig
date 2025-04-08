import express from 'express';
import { pool } from '../config/db.js';

const routerFaqs = express.Router();

// 1. Получение всех FAQ (с фильтрацией по статусу)
routerFaqs.get('/faqs', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM faq';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Изменение конкретного FAQ
routerFaqs.patch('/faqs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, status } = req.body;

    // Проверка наличия хотя бы одного поля для обновления
    if (!question && !answer && !status) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    let query = 'UPDATE faq SET';
    const params = [];
    let paramIndex = 1;

    if (question) {
      query += ` question = $${paramIndex}`;
      params.push(question);
      paramIndex++;
    }

    if (answer) {
      query += `${paramIndex > 1 ? ',' : ''} answer = $${paramIndex}`;
      params.push(answer);
      paramIndex++;
    }

    if (status) {
      query += `${paramIndex > 1 ? ',' : ''} status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += `, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const { rows } = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Удаление конкретного FAQ (мягкое удаление через статус)
routerFaqs.delete('/faqs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      `UPDATE faq SET status = 'deleted', updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    res.json({ 
      message: 'FAQ marked as deleted',
      data: rows[0] 
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default routerFaqs;