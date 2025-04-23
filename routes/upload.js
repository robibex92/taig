import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Настройка хранилища
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    // Получаем расширение файла
    const ext = path.extname(file.originalname) || '';
    // Генерируем латинское имя: random + дата + расширение
    const random = Math.floor(Math.random() * 1e8);
    const uniqueName = `${Date.now()}-${random}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post('/', upload.single('file'), (req, res) => {
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

import fs from 'fs';

// Удаление файла изображения
router.delete('/delete-image', async (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) {
      return res.status(400).json({ success: false, message: 'Не указан путь к файлу' });
    }
    // Только относительный путь внутри uploads
    const uploadsDir = path.join(__dirname, '../uploads');
    // Извлекаем только имя файла, чтобы не было попытки выйти за пределы папки
    const fileName = path.basename(relPath);
    const filePath = path.join(uploadsDir, fileName);

    // Проверяем, что файл действительно находится в папке uploads
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(400).json({ success: false, message: 'Некорректный путь' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Файл не найден' });
    }

    await fs.promises.unlink(filePath);
    return res.json({ success: true, message: 'Файл удалён' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Ошибка при удалении файла', error: err.message });
  }
});

export default router;
