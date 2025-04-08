import { getUserByTelegramId, createUser, updateUser, saveRefreshToken } from '../services/user-service.js';
import { generateTokens, verifyToken } from '../services/token-service.js';

// Авторизация через Telegram
export const authenticateUser = async (req, res) => {
  try {
    const { telegram_token, user_data } = req.body;

    // Проверка токена через Telegram API (пример)
    const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    if (!telegramResponse.ok) {
      return res.status(401).json({ error: 'Invalid Telegram token' });
    }

    // Проверка существования пользователя
    let user = await getUserByTelegramId(user_data.telegram_id);
    if (!user) {
      user = await createUser(user_data);
    } else {
      user = await updateUser(user.id, user_data);
    }

    // Генерация токенов
    const { accessToken, refreshToken } = generateTokens(user);

    // Сохранение Refresh Token в базе данных
    await saveRefreshToken(user.id, refreshToken);

    // Установка Refresh Token в HttpOnly Cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Только для HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });

    // Возвращение Access Token
    res.json({ message: 'User authenticated successfully', user, accessToken });
  } catch (error) {
    console.error('Error authenticating user:', error);
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

    const user = await getUserByTelegramId(decoded.telegram_id);
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

    const user = await getUserByTelegramId(decoded.telegram_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await updateUser(user.id, req.body);
    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};