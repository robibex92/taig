import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { logger } from "../../core/utils/logger.js";
import { AppError, ValidationError } from "../../core/errors/AppError.js";
import {
  isStorableFormat,
  needsJpegTranscode,
  storedExtension,
  UNSUPPORTED_IMAGE_MESSAGE,
} from "../../core/utils/storedImage.js";
import { isHeicBuffer, decodeHeicToJpeg } from "../../core/utils/heicImage.js";
import {
  UPLOAD_ROOT,
  getUploadPath,
  getUploadUrl,
} from "../../core/constants/uploadPaths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * File Upload Service
 * Handles file upload and deletion operations
 */
export class FileUploadService {
  constructor() {
    // Используем единые константы путей
    this.uploadsDir = UPLOAD_ROOT;
    this._ensureUploadsDirExists();
  }

  /**
   * Ensure uploads directory exists
   */
  _ensureUploadsDirExists() {
    if (!fs.existsSync(this.uploadsDir)) {
      logger.info("Creating uploads directory", { path: this.uploadsDir });
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Get file URLs from uploaded files
   */
  getFileUrls(files, serverUrl) {
    if (!files || files.length === 0) {
      return [];
    }

    return files.map((file) => `${serverUrl}/api-v1/uploads/${file.filename}`);
  }

  /** Имя того же файла с другим расширением. */
  _withExtension(filename, extension) {
    if (!extension) return filename;

    return `${path.basename(filename).replace(/\.[^.]*$/, "")}${extension}`;
  }

  /**
   * Привести принятые файлы к тому виду, который обещает их имя.
   *
   * `multer` кладёт байты как они пришли: снимок iPhone — это HEIC, а браузер и
   * `express.static` ждут от `.jpg` именно JPEG. Здесь формат определяется по
   * содержимому, HEIC/AVIF/TIFF перекодируются в JPEG, а файл получает то
   * расширение, которое соответствует его байтам. Мутирует `file.filename` —
   * урлы строятся уже после.
   */
  async normalizeStored(files) {
    for (const file of files ?? []) {
      const source = path.join(this.uploadsDir, file.filename);
      const bytes = await fs.promises.readFile(source);
      const format = await this._detectFormat(bytes, file.filename);

      if (!isStorableFormat(format)) {
        await fs.promises.rm(source, { force: true });
        throw new ValidationError(UNSUPPORTED_IMAGE_MESSAGE);
      }

      const target = path.join(
        this.uploadsDir,
        this._withExtension(file.filename, storedExtension(format))
      );

      if (needsJpegTranscode(format)) {
        await this._writeJpeg(source, target, bytes);

        if (target !== source) await fs.promises.rm(source, { force: true });
      } else if (target !== source) {
        await fs.promises.rename(source, target);
      }

      file.filename = path.basename(target);
    }

    return files;
  }

  /**
   * Формат по содержимому. `null` — файл не похож на картинку, которую мы умеем
   * хранить. HEIC sharp распознаёт как `heif` по заголовку, но иногда не может
   * и заголовок — тогда спасает разбор бренда контейнера.
   */
  async _detectFormat(bytes, filename) {
    try {
      const { format } = await sharp(bytes).metadata();
      if (format) return format;
    } catch (error) {
      logger.debug("sharp не прочитал заголовок файла", {
        filename,
        error: error.message,
      });
    }

    return isHeicBuffer(bytes) ? "heif" : null;
  }

  /**
   * Снимок в контейнере → JPEG на диске.
   *
   * Сначала sharp: он умеет AVIF, TIFF и HEIC в сборках с libde265. Если sharp
   * пиксели не раскодировал (prebuilt-сборка без HEVC-декодера отвечает
   * «bad seek»), для HEIC включается WASM-распаковщик libheif. Другой контейнер
   * под тем же предлогом не перекодируем: для AVIF/TIFF такой fallback нет.
   */
  async _writeJpeg(source, target, bytes) {
    let sharpError;

    try {
      await sharp(source)
        .rotate()
        .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toFile(target);

      return;
    } catch (error) {
      sharpError = error;
    }

    if (isHeicBuffer(bytes)) {
      try {
        await fs.promises.writeFile(target, await decodeHeicToJpeg(bytes));

        logger.info("HEIC раскодирован libheif (WASM)", {
          filename: path.basename(target),
          sharpError: sharpError.message,
        });

        return;
      } catch (error) {
        logger.error("HEIC не раскодирован ни sharp, ни libheif", {
          error: error.message,
        });
      }
    }

    await fs.promises.rm([source, target], { force: true });

    throw new ValidationError(
      isHeicBuffer(bytes)
        ? "Телефон прислал снимок в HEIC, а сервер не смог его прочитать — выберите фото ещё раз или приложите обычный JPEG"
        : "Не удалось обработать это изображение — приложите JPG, PNG, WEBP или GIF"
    );
  }

  /**
   * Файлы в каталоге загрузок, включая подпапки (`ad-images/`, `car-images/`).
   * Отдаёт относительный путь, абсолютный путь и размер — этого хватает, чтобы
   * решить, пора ли файл убирать, и сказать, сколько освободилось.
   */
  async listStoredFiles() {
    const found = [];

    const walk = async (dir, relative) => {
      let entries;

      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        // Подпапки может не быть — это не ошибка, а «там пусто».
        return;
      }

      for (const entry of entries) {
        const childRelative = path.posix.join(relative, entry.name);
        const childPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(childPath, childRelative);
          continue;
        }

        if (!entry.isFile()) continue;

        const stats = await fs.promises.stat(childPath);

        found.push({
          filename: entry.name,
          relativePath: childRelative,
          absolutePath: childPath,
          sizeBytes: stats.size,
          modifiedAt: stats.mtime,
        });
      }
    };

    await walk(this.uploadsDir, "");

    return found;
  }

  /** Удалить файл по пути, полученному из `listStoredFiles`. */
  async removeStoredFile(absolutePath) {
    const resolved = path.resolve(absolutePath);

    // Свой же каталог проверяем ещё раз: путь пришёл из обхода диска, но
    // ошибиться в нём — значит удалить не то.
    if (resolved !== this.uploadsDir && !resolved.startsWith(this.uploadsDir + path.sep)) {
      throw new AppError("Invalid file path", 400);
    }

    await fs.promises.unlink(resolved);
  }

  /**
   * Delete a file
   */
  async deleteFile(relPath) {
    if (!relPath) {
      throw new AppError("File path not provided", 400);
    }

    const fileName = path.basename(relPath);
    const filePath = path.join(this.uploadsDir, fileName);

    // Security check: ensure file path is within uploads directory
    if (!filePath.startsWith(this.uploadsDir)) {
      throw new AppError("Invalid file path", 400);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new AppError("File not found", 404);
    }

    // Delete file
    try {
      await fs.promises.unlink(filePath);
      logger.info("File deleted", { path: filePath });
      return true;
    } catch (error) {
      logger.error("Error deleting file", {
        path: filePath,
        error: error.message,
      });
      throw new AppError("Error deleting file", 500);
    }
  }

  /**
   * Get uploads directory path
   */
  getUploadsDir() {
    return this.uploadsDir;
  }
}
