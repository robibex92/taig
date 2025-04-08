import pool from '../config/db.js';
import bcrypt from 'bcrypt';

// Хеширование данных (если потребуется)
const hashData = async (data) => {
  const saltRounds = 10;
  return await bcrypt.hash(data, saltRounds);
};

// Получение пользователя по Telegram ID
export const getUserByTelegramId = async (telegram_id) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegram_id]);
  return rows[0];
};

// Создание нового пользователя
export const createUser = async (userData) => {
  const { telegram_id, username, first_name, last_name, photo_url } = userData;
  const query = `
    INSERT INTO users (telegram_id, username, first_name, last_name, photo_url)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [telegram_id, username, first_name, last_name, photo_url]);
  return rows[0];
};

// Обновление данных пользователя
export const updateUser = async (id, updates) => {
  const keys = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
  const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const { rows } = await pool.query(query, [id, ...values]);
  return rows[0];
};

// Сохранение Refresh Token
export const saveRefreshToken = async (id, refreshToken) => {
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, id]);
  };
  
  // Получение Refresh Token
  export const getRefreshToken = async (id) => {
    const { rows } = await pool.query('SELECT refresh_token FROM users WHERE id = $1', [id]);
    return rows[0]?.refresh_token;
  };