import express from "express";
import {
  authenticateUser,
  refreshAccessToken,
  getSessionUser,
  logoutUser,
} from "../controllers/user-controller.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Авторизация через Telegram
router.post("/api/auth/telegram", authenticateUser);

// Обновление Access Token
router.post("/api/auth/refresh", refreshAccessToken);

// Получение данных текущей сессии пользователя
router.get("/api/auth/session", authenticateJWT, getSessionUser);

// Выход пользователя
router.post("/api/auth/logout", authenticateJWT, logoutUser);

export default router;
