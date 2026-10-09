import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../errors/AppError.js";
import { UPLOAD_ROOT } from "../constants/uploadPaths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = UPLOAD_ROOT;

    if (!fs.existsSync(uploadDir)) {
      logger.info("Creating upload directory", { path: uploadDir });
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Расширение — то, что принёс клиент; настоящий формат определит sharp и
    // по нему `FileUploadService.normalizeStored` даст файлу честное имя.
    // Прежний «нет расширения → .jpg» и «HEIC → .jpg» врал байтам, и картинка
    // не открывалась ни в одном браузере.
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    const uniqueName = `${Date.now()}-${Math.floor(Math.random() * 1e8)}${ext}`;

    // На каждый файл объявления (а их до 10 в запросе) info-строка превращала
    // журнал в ленту загрузки; подробности нужны только при разборе проблем.
    logger.debug("File accepted for upload", {
      original: file.originalname,
      mime: file.mimetype,
      filename: uniqueName,
    });

    cb(null, uniqueName);
  },
});

/**
 * `uploads/` раздаётся с того же origins, что и приложение, поэтому сюда
 * пускаем только растровые снимки: SVG — это полноценный HTML со скриптом, а
 * всё остальное — произвольный файл, который кто-то скачает с нашего диска.
 * HEIC/HEIF снимает телефон, и он же нередко приходит с типом
 * `application/octet-stream` — для него ориентируемся на расширение, а
 * настоящий формат всё равно проверит `normalizeStored` по байтам.
 */
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/** Расширения, которым доверяем даже без честного MIME. */
const ALLOWED_IMAGE_EXTENSION = new Set([
  ".jpg",
  ".jpeg",
  ".pjpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
]);

export const imageFileFilter = (req, file, cb) => {
  const mime = String(file.mimetype).toLowerCase();

  if (ALLOWED_IMAGE_MIME.has(mime)) return cb(null, true);

  // Тип, который браузеры кладут на незнакомый контейнер: принимаем по
  // расширению, а дальше решает разбор байтов. Расширение смотрим только для
  // него — при честном MIME файла у запроса может и не быть имени.
  const browserOpaqueType = mime === "" || mime === "application/octet-stream";

  if (browserOpaqueType) {
    const extension = path.extname(String(file.originalname ?? "")).toLowerCase();
    if (ALLOWED_IMAGE_EXTENSION.has(extension)) return cb(null, true);
  }

  cb(
    new ValidationError(
      "Можно загружать только изображения (JPG, PNG, WEBP, GIF, HEIC)"
    )
  );
};

// Configure multer
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: imageFileFilter,
});
