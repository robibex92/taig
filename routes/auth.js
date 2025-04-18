import express from 'express';
import { authenticateUser, refreshAccessToken } from '../controllers/user-controller.js';

const router = express.Router();

// Авторизация через Telegram
router.post('/api/auth/telegram', authenticateUser);

// Обновление Access Token
router.post('/api/auth/refresh', refreshAccessToken);

export default router;