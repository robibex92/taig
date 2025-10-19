import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Upload Controller
 * Handles file upload and deletion operations
 */
export class UploadController {
  constructor(fileUploadService) {
    this.fileUploadService = fileUploadService;
  }

  /**
   * POST /api-v1/upload
   * Upload multiple files (up to 10)
   */
  uploadFiles = asyncHandler(async (req, res) => {
    logger.info("Upload request received", {
      filesCount: req.files ? req.files.length : 0,
    });

    if (!req.files || req.files.length === 0) {
      throw new ValidationError("No files uploaded");
    }

    // Используем API_URL из переменных окружения для правильного домена
    const serverUrl = process.env.API_URL
      ? process.env.API_URL.replace("/api-v1", "")
      : req.protocol + "://" + req.get("host");
    const fileUrls = this.fileUploadService.getFileUrls(req.files, serverUrl);

    logger.info("Files uploaded successfully", {
      count: fileUrls.length,
      urls: fileUrls,
    });

    res.json({
      success: true,
      fileUrls,
    });
  });

  /**
   * DELETE /api-v1/upload/delete-image
   * Delete a file
   */
  deleteFile = asyncHandler(async (req, res) => {
    const relPath = req.query.path;

    if (!relPath) {
      throw new ValidationError("File path not provided");
    }

    await this.fileUploadService.deleteFile(relPath);

    res.json({
      success: true,
      message: "File deleted",
    });
  });
}
