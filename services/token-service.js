import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export const generateTokens = (user) => {
  const accessToken = jwt.sign({ id: user.id, telegram_id: user.telegram_id }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id, telegram_id: user.telegram_id }, JWT_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

// Проверка токена
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};