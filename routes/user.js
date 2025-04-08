import express from 'express';
import { getCurrentUser, updateCurrentUser } from '../controllers/user-controller.js';

const router = express.Router();

// Получение данных текущего пользователя
router.get('/users/me', getCurrentUser);

// Обновление данных текущего пользователя
router.patch('/users/me', updateCurrentUser);

export default router;