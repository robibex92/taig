import { getUserByTelegramId, createUser, updateUser, saveRefreshToken } from '../services/user-service.js';
import { generateTokens, verifyToken } from '../services/token-service.js';
import crypto from "crypto";

// Авторизация через Telegram
export const authenticateUser = async (req, res) => {
  
  try {
    const { telegram_token, user_data } = req.body;

if (!checkTelegramAuth(user_data, process.env.TELEGRAM_BOT_TOKEN)) {
  return res.status(401).json({ error: 'Invalid Telegram signature' });
}
  function checkTelegramAuth(user_data, botToken) {
    const secret = crypto.createHash('sha256').update(botToken).digest();
    const dataCheckString = Object.keys(user_data)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => `${key}=${user_data[key]}`)
      .join('\n');
    const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    return hmac === user_data.hash;
  }

    // Проверка токена через Telegram API (пример)
    const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    if (!telegramResponse.ok) {
      return res.status(401).json({ error: 'Invalid Telegram token' });
    }

    // Проверка существования пользователя
    const telegramId = user_data.id; // id из Telegram всегда есть
let user = await getUserByTelegramId(telegramId);
if (!user) {
  user = await createUser({
    user_id: telegramId,
    username: user_data.username,
    first_name: user_data.first_name,
    last_name: user_data.last_name,
    avatar: user_data.photo_url
  });
} else {
  user = await updateUser(telegramId, {
    username: user_data.username,
    first_name: user_data.first_name,
    last_name: user_data.last_name,
    avatar: user_data.photo_url
  });
}

    // Генерация токенов
    const { accessToken, refreshToken } = generateTokens(user);
    console.log('Access Token:', accessToken);
    console.log('Refresh Token:', refreshToken);

    // Сохранение Refresh Token в базе данных
    await saveRefreshToken(user.user_id, refreshToken);

    // Установка Refresh Token в HttpOnly Cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Только для HTTPS в проде
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' для прода, 'lax' для локалки
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Возвращение Access Token
    res.json({ message: 'User authenticated successfully', user, accessToken });
  } catch (error) {
    console.error('Error authenticating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Обновление Access Token
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies || {};

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    // Проверка Refresh Token
    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Проверка соответствия Refresh Token в базе данных
    const storedRefreshToken = await getRefreshToken(decoded.id);
    if (storedRefreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Генерация новых токенов
    const user = await getUserByTelegramId(decoded.user_id);
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Обновление Refresh Token в базе данных
    await saveRefreshToken(user.user_id, newRefreshToken);

    // Установка нового Refresh Token в HttpOnly Cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Только для HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });

    // Возвращение нового Access Token
    res.json({ accessToken });
  } catch (error) {
    console.error('Error refreshing access token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Получение данных текущего пользователя
export const getCurrentUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await getUserByTelegramId(decoded.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Обновление данных пользователя
export const updateCurrentUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await getUserByTelegramId(decoded.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await updateUser(user.user_id, req.body);
    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};