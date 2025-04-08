import express from 'express';
import { authenticateUser, refreshAccessToken } from '../controllers/user-controller.js';

const router = express.Router();

// Авторизация через Telegram
router.post('/auth/telegram', authenticateUser);

// Обновление Access Token
router.post('/auth/refresh', refreshAccessToken);

export default router;