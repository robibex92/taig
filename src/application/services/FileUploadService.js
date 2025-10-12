import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../../core/utils/logger.js";
import { AppError } from "../../core/errors/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * File Upload Service
 * Handles file upload and deletion operations
 */
export class FileUploadService {
  constructor() {
    this.uploadsDir = path.join(__dirname, "../../../../Uploads");
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

    return files.map((file) => `${serverUrl}/uploads/${file.filename}`);
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
