import express from "express";
import {
  getCurrentUser,
  updateCurrentUser,
} from "../controllers/user-controller.js";
import { pool } from "../config/db.js";

const userRouter = express.Router();
const publicUserRouter = express.Router();

// Protected: получение данных текущего пользователя
userRouter.get("/api/users/me", getCurrentUser);

// Protected: обновление данных текущего пользователя
userRouter.patch("/api/users/me", updateCurrentUser);



// Public: получение данных любого пользователя по ID
publicUserRouter.get("/api/users/:user_id", async (req, res) => {
  try {
    const user_id = req.user?.id || req.params.user_id;
    console.log("Запрос на пользователя с ID:", user_id);

    const { rows } = await pool.query(
      "SELECT first_name, last_name, telegram_first_name, telegram_last_name, is_manually_updated FROM users WHERE user_id = $1",
      [parseInt(user_id)]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];

    // Определяем имя и фамилию по логике
    const firstName = user.is_manually_updated
      ? user.telegram_first_name || ""
      : user.first_name || "";

    const lastName = user.is_manually_updated
      ? user.telegram_last_name || ""
      : user.last_name || "";

    res.json({
      user_id,
      first_name: firstName,
      last_name: lastName,
      is_manually_updated: user.is_manually_updated,
    });
  } catch (error) {
    console.error("Ошибка при получении пользователя:", error);
    res.status(500).json({ error: error.message });
  }
});

// Public: получение аватарки пользователя
publicUserRouter.get("/api/users/:user_id/avatar", async (req, res) => {
  try {
    const user_id = req.user?.id || req.params.user_id;

    // Ищем пользователя в базе данных
    const { rows } = await pool.query(
      "SELECT avatar FROM users WHERE user_id = $1",
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const avatarUrl = rows[0].avatar;

    // Если аватарка не существует
    if (!avatarUrl) {
      return res.json({ avatar_url: null }); // Возвращаем null, если аватарка отсутствует
    }

    // Возвращаем URL аватарки
    res.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error("Error fetching user avatar:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export { publicUserRouter };
export default userRouter;
