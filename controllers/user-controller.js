import {
  getUserByTelegramId,
  createUser,
  updateUser,
  saveRefreshToken,
  getRefreshToken,
} from "../services/user-service.js";
import { generateTokens, verifyToken } from "../services/token-service.js";
import crypto from "crypto";

// Функция для проверки подписи Telegram (оставляем ее здесь)
function checkTelegramAuth(user_data, botToken) {
  const secret = crypto.createHash("sha256").update(botToken).digest();
  const dataCheckString = Object.keys(user_data)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${user_data[key]}`)
    .join("\n");
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  return hmac === user_data.hash;
}

// Авторизация через Telegram (обновленная реализация)
export const authenticateUser = async (req, res) => {
  try {
    const { telegram_token, user_data } = req.body;
    if (!telegram_token || !user_data || !user_data.id) {
      return res.status(400).json({ error: "Invalid Telegram data" });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const dataCheckString = Object.keys(user_data)
      .filter((key) => key !== "hash")
      .sort()
      .map((key) => `${key}=${user_data[key]}`)
      .join("\n");
    const secretKey = crypto.createHash("sha256").update(botToken).digest();
    const hash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (hash !== telegram_token) {
      return res.status(401).json({ error: "Invalid Telegram token" });
    }

    let user = await getUserByTelegramId(user_data.id);
    if (!user) {
      user = await createUser({
        user_id: user_data.id,
        username: user_data.username,
        first_name: user_data.first_name,
        last_name: user_data.last_name,
        avatar: user_data.photo_url,
      });
    } else {
      user = await updateUser(user_data.id, {
        username: user_data.username,
        first_name: user_data.first_name,
        last_name: user_data.last_name,
        avatar: user_data.photo_url,
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    await saveRefreshToken(user.user_id, refreshToken);

    const safeUser = {
      user_id: user.user_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar: user.avatar,
      status: user.status,
      telegram_first_name: user.telegram_first_name,
      telegram_last_name: user.telegram_last_name,
      is_manually_updated: user.is_manually_updated,
    };
    res.json({
      user: safeUser,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

// Получение данных текущего пользователя для сессии
export const getSessionUser = async (req, res) => {
  try {
    console.log("getSessionUser called with req.user:", req.user);
    console.log("Authorization header:", req.headers.authorization);

    // Пользователь добавлен в req.user middleware-ом authenticateJWT
    if (!req.user || !req.user.user_id) {
      console.log("No user in request or missing user_id");
      return res.status(401).json({ error: "User not authenticated" });
    }

    console.log("Fetching user with user_id:", req.user.user_id);
    const user = await getUserByTelegramId(req.user.user_id);
    console.log("getUserByTelegramId result:", user);

    if (!user) {
      console.log("User not found in database");
      return res.status(404).json({ error: "User not found" });
    }

    // Возвращаем только безопасные поля пользователя
    const safeUser = {
      user_id: user.user_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar: user.avatar,
      status: user.status,
      telegram_first_name: user.telegram_first_name,
      telegram_last_name: user.telegram_last_name,
      is_manually_updated: user.is_manually_updated,
    };
    console.log("Returning safe user data:", safeUser);
    res.json(safeUser);
  } catch (error) {
    console.error("Error in getSessionUser:", error);
    res.status(500).json({ error: "Failed to fetch session user" });
  }
};

// Выход пользователя
export const logoutUser = async (req, res) => {
  try {
    // Пользователь добавлен в req.user middleware-ом authenticateJWT
    if (!req.user || !req.user.user_id) {
      // Если нет req.user, токен уже невалиден или отсутствует, просто считаем, что пользователь разлогинен
      return res.json({ message: "Logged out successfully" });
    }
    await saveRefreshToken(req.user.user_id, null); // Очистка refreshToken в базе данных
    // Очистка HttpOnly Cookie на клиенте
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.API_URL && process.env.API_URL.startsWith("https"),
      sameSite:
        process.env.API_URL && process.env.API_URL.startsWith("https")
          ? "None"
          : "lax",
    });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

// Обновление Access Token (оставляем как было)
export const refreshAccessToken = async (req, res) => {
  try {
    // *** START LOG - Received refresh request ***
    console.log("Received refresh request");
    console.log("Received headers:", req.headers);
    // *** END LOG ***

    const refreshToken = req.headers.authorization?.split(" ")[1];
    if (!refreshToken) {
      // *** START LOG ***
      console.log("No refresh token found in Authorization header");
      // *** END LOG ***
      return res.status(401).json({ error: "Refresh token missing" });
    }

    // *** START LOG ***
    console.log("Extracted refreshToken:", refreshToken);
    // *** END LOG ***

    const decoded = verifyToken(refreshToken);
    if (!decoded || !decoded.id) {
      // *** START LOG ***
      console.log("Refresh token verification failed or missing id");
      // *** END LOG ***
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    // *** START LOG - Fetching user ***
    console.log("Attempting to fetch user with decoded.id:", decoded.id);
    // *** END LOG ***

    const user = await getUserByTelegramId(decoded.id);

    // *** START LOG - Result of fetching user ***
    console.log("Result of getUserByTelegramId:", user);
    // *** END LOG ***

    if (!user) {
      console.log("User not found for id:", decoded.id);
      return res.status(404).json({ error: "User not found" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await saveRefreshToken(user.user_id, newRefreshToken);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error("Error refreshing access token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Обновление данных пользователя (оставляем как было)
export const updateCurrentUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Authorization header missing or invalid" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    console.log("Updating user with ID:", decoded.id); // Добавляем лог для отладки
    const user = await getUserByTelegramId(decoded.id);
    if (!user) {
      console.log("User not found for ID:", decoded.id); // Добавляем лог для отладки
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await updateUser(user.user_id, req.body);
    res.json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
