import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Get current session
router.get('/session', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Telegram authentication
router.post('/telegram', async (req, res) => {
  try {
    const { id, username, first_name, last_name } = req.body;

    // Check if user exists
    let result = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [id]
    );

    let userId;

    if (result.rows.length === 0) {
      // Create new user
      result = await pool.query(
        'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id',
        [id, username, first_name, last_name]
      );
      userId = result.rows[0].id;
    } else {
      userId = result.rows[0].id;
    }

    // Set session
    req.session.userId = userId;

    // Return user data
    res.json({
      id: userId,
      username,
      first_name,
      last_name
    });
  } catch (err) {
    console.error('Telegram auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.clearCookie('sid');
    res.json({ message: 'Logged out successfully' });
  });
});

export default router;
