import express from 'express';
import cors from 'cors';
import telegramRoutes from './routes/telegram.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors()); // Разрешает запросы с фронта
app.use(express.json());

app.use('/api/telegram', telegramRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
