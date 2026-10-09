import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { uploadLimiter } from "../middlewares/securityMiddleware.js";
import { upload } from "../../core/middlewares/uploadMiddleware.js";

const router = express.Router();
const uploadController = container.resolve("uploadController");

/**
 * Загрузка файлов на диск.
 *
 * Раньше оба маршрута были открыты «на потом» (в jsdoc так и стояло), то есть
 * любой аноним мог заливать файлы в `uploads/` и стирать любой уже загруженный
 * файл по имени. Файл, который ещё ни на что не ссылается, ничему не
 * принадлежит, поэтому право здесь одно: быть вошедшим жителем, а привязку к
 * объявлению проверяют маршруты самих объявлений.
 *
 * Поверх права — квота `uploadLimiter` и белый список типов в `upload`: каталог
 * `uploads/` отдаётся с того же origins, что и приложение.
 */

/**
 * @route   POST /upload
 * @desc    Upload multiple files (up to 10)
 * @access  Private
 */
router.post(
  "/upload",
  authenticateJWT,
  uploadLimiter,
  upload.array("photos", 10),
  uploadController.uploadFiles
);

/**
 * @route   DELETE /upload/delete-image
 * @desc    Delete a file
 * @access  Private
 */
router.delete("/upload/delete-image", authenticateJWT, uploadController.deleteFile);

/**
 * @route   POST /upload/sweep
 * @desc    Список файлов, которые никто не использует (удаление — только `dry_run=false`)
 * @access  Private (модерация)
 */
router.post("/upload/sweep", authenticateJWT, uploadController.sweep);

export default router;
