import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export const generateTokens = (user) => {
  // accessToken живёт 15 минут, refreshToken — 30 дней
  const accessToken = jwt.sign({ id: user.user_id }, JWT_SECRET, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign({ id: user.user_id }, JWT_SECRET, {
    expiresIn: "30d",
  });
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
