import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Единые пути для загрузки файлов
 * Все сервисы должны использовать эти константы для синхронизации путей
 */

// Корневая папка для всех загрузок
export const UPLOAD_ROOT = path.resolve(__dirname, "../../../uploads");

// Подпапки для разных типов файлов
export const UPLOAD_PATHS = {
  ROOT: UPLOAD_ROOT,
  CAR_IMAGES: path.join(UPLOAD_ROOT, "car-images"),
  AD_IMAGES: path.join(UPLOAD_ROOT, "ad-images"),
  PROFILE_IMAGES: path.join(UPLOAD_ROOT, "profile-images"),
};

// URL пути для доступа к файлам
export const UPLOAD_URLS = {
  ROOT: "/uploads",
  API_V1: "/api-v1/uploads",
  CAR_IMAGES: "/uploads/car-images",
  AD_IMAGES: "/uploads/ad-images",
  PROFILE_IMAGES: "/uploads/profile-images",
};

/**
 * Получить полный путь к файлу
 */
export function getUploadPath(subPath = "") {
  return path.join(UPLOAD_ROOT, subPath);
}

/**
 * Получить URL для доступа к файлу
 */
export function getUploadUrl(filename, subPath = "") {
  const urlPath = subPath
    ? `${UPLOAD_URLS.ROOT}/${subPath}/${filename}`
    : `${UPLOAD_URLS.ROOT}/${filename}`;
  return urlPath;
}

/**
 * Логирование путей для отладки
 */
export function logUploadPaths() {
  console.log("=== UPLOAD PATHS DEBUG ===");
  console.log("UPLOAD_ROOT:", UPLOAD_ROOT);
  console.log("UPLOAD_PATHS:", UPLOAD_PATHS);
  console.log("UPLOAD_URLS:", UPLOAD_URLS);
  console.log("==========================");
}
