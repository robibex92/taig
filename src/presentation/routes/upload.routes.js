import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { upload } from "../../core/middlewares/uploadMiddleware.js";

const router = express.Router();
const uploadController = container.resolve("uploadController");

/**
 * @route   POST /api/v1/upload
 * @desc    Upload multiple files (up to 10)
 * @access  Private (add auth middleware if needed)
 */
router.post(
  "/api/v1/upload",
  upload.array("photos", 10),
  uploadController.uploadFiles
);

/**
 * @route   DELETE /api/v1/upload/delete-image
 * @desc    Delete a file
 * @access  Private (add auth middleware if needed)
 */
router.delete("/api/v1/upload/delete-image", uploadController.deleteFile);

export default router;
