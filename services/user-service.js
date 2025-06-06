import { pool } from "../config/db.js";
import bcrypt from "bcrypt";

// Хеширование данных (если потребуется)
const hashData = async (data) => {
  const saltRounds = 10;
  return await bcrypt.hash(data, saltRounds);
};

// Получение пользователя по Telegram ID
export const getUserByTelegramId = async (user_id) => {
  // *** START LOG ***
  console.log(
    "getUserByTelegramId called with user_id:",
    user_id,
    "type:",
    typeof user_id
  );
  // *** END LOG ***

  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE user_id = $1",
      [user_id]
    );
    // *** START LOG ***
    console.log("getUserByTelegramId query result rows:", rows);
    // *** END LOG ***
    return rows[0];
  } catch (error) {
    console.error("Error in getUserByTelegramId query:", error);
    throw error; // Перебрасываем ошибку для обработки выше
  }
};

// Создание нового пользователя
export const createUser = async (userData) => {
  // userData должен содержать user_id, username, first_name, last_name, avatar
  const { user_id, username, first_name, last_name, avatar } = userData;
  const query = `
    INSERT INTO users (user_id, username, first_name, last_name, avatar)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [
    user_id,
    username,
    first_name,
    last_name,
    avatar,
  ]);
  return rows[0];
};

// Обновление данных пользователя
export const updateUser = async (user_id, updates) => {
  console.log("updateUser called with updates:", updates);

  // Расширенный список разрешенных полей
  const allowedFields = [
    "username",
    "first_name",
    "last_name",
    "avatar",
    "telegram_first_name",
    "telegram_last_name",
    "is_manually_updated",
    "status",
  ];

  const keys = Object.keys(updates).filter((key) =>
    allowedFields.includes(key)
  );

  console.log("Filtered update fields:", keys);

  if (keys.length === 0) {
    const receivedFields = Object.keys(updates);
    throw new Error(
      `No valid fields to update. Received: ${receivedFields.join(", ")}. ` +
        `Allowed fields: ${allowedFields.join(", ")}`
    );
  }

  const values = keys.map((key) => updates[key]);
  const setClause = keys
    .map((key, index) => `${key} = $${index + 1}`)
    .join(", ");

  const query = `UPDATE users SET ${setClause} WHERE user_id = $${
    keys.length + 1
  } RETURNING *`;

  console.log("Update query:", query);
  console.log("Update values:", values);

  const { rows } = await pool.query(query, [...values, user_id]);
  return rows[0];
};

// Сохранение Refresh Token
export const saveRefreshToken = async (user_id, refreshToken) => {
  console.log(`Saving refresh token for user_id: ${user_id}`);
  try {
    await pool.query("UPDATE users SET refresh_token = $1 WHERE user_id = $2", [
      refreshToken,
      user_id,
    ]);
    console.log("Refresh token saved successfully");
  } catch (error) {
    console.error("Error saving refresh token:", error);
  }
};

// Получение Refresh Token
export const getRefreshToken = async (user_id) => {
  const { rows } = await pool.query(
    "SELECT refresh_token FROM users WHERE user_id = $1",
    [user_id]
  );
  return rows[0]?.refresh_token;
};
