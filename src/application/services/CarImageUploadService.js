import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../../core/utils/logger.js";
import { AppError } from "../../core/errors/AppError.js";
import multer from "multer";
import sharp from "sharp";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Car Image Upload Service
 * Handles car image upload with optimization and validation
 */
export class CarImageUploadService {
  constructor() {
    this.uploadsDir = path.join(__dirname, "../../../uploads/car-images");
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    this._ensureUploadsDirExists();
  }

  /**
   * Ensure uploads directory exists
   */
  _ensureUploadsDirExists() {
    if (!fs.existsSync(this.uploadsDir)) {
      logger.info("Creating car images uploads directory", {
        path: this.uploadsDir,
      });
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Generate unique filename
   */
  _generateFilename(originalName) {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString("hex");
    return `car_${timestamp}_${random}${ext}`;
  }

  /**
   * Configure multer for file upload
   */
  getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadsDir);
      },
      filename: (req, file, cb) => {
        const filename = this._generateFilename(file.originalname);
        cb(null, filename);
      },
    });

    const fileFilter = (req, file, cb) => {
      if (this.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new AppError(
            `Неподдерживаемый тип файла: ${
              file.mimetype
            }. Разрешены: ${this.allowedMimeTypes.join(", ")}`,
            400
          ),
          false
        );
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 5, // Максимум 5 файлов за раз
      },
    });
  }

  /**
   * Process and optimize uploaded image
   */
  async processImage(filePath) {
    try {
      const optimizedPath = filePath.replace(/(\.[^.]+)$/, "_optimized$1");

      await sharp(filePath)
        .resize(1920, 1080, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toFile(optimizedPath);

      // Replace original with optimized version
      await fs.promises.rename(optimizedPath, filePath);

      logger.info("Image processed and optimized", {
        originalPath: filePath,
        optimized: true,
      });

      return filePath;
    } catch (error) {
      logger.error("Error processing image", {
        filePath,
        error: error.message,
      });
      throw new AppError("Ошибка обработки изображения", 500);
    }
  }

  /**
   * Get file URL
   */
  getFileUrl(filename, serverUrl) {
    return `${serverUrl}/uploads/car-images/${filename}`;
  }

  /**
   * Delete image file
   */
  async deleteImage(filename) {
    if (!filename) {
      throw new AppError("Имя файла не указано", 400);
    }

    const filePath = path.join(this.uploadsDir, filename);

    // Security check: ensure file path is within uploads directory
    if (!filePath.startsWith(this.uploadsDir)) {
      throw new AppError("Неверный путь к файлу", 400);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.warn("File not found for deletion", { filePath });
      return false; // Don't throw error if file doesn't exist
    }

    // Delete file
    try {
      await fs.promises.unlink(filePath);
      logger.info("Car image deleted", { filePath });
      return true;
    } catch (error) {
      logger.error("Error deleting car image", {
        filePath,
        error: error.message,
      });
      throw new AppError("Ошибка удаления изображения", 500);
    }
  }

  /**
   * Validate image file
   */
  validateImage(file) {
    if (!file) {
      throw new AppError("Файл не загружен", 400);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError(`Неподдерживаемый тип файла: ${file.mimetype}`, 400);
    }

    if (file.size > this.maxFileSize) {
      throw new AppError(
        `Размер файла превышает ${this.maxFileSize / 1024 / 1024}MB`,
        400
      );
    }

    return true;
  }

  /**
   * Get uploads directory path
   */
  getUploadsDir() {
    return this.uploadsDir;
  }
}
