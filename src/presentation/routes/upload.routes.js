import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { upload } from "../../core/middlewares/uploadMiddleware.js";

const router = express.Router();
const uploadController = container.resolve("uploadController");

/**
 * @route   POST /upload
 * @desc    Upload multiple files (up to 10)
 * @access  Private (add auth middleware if needed)
 */
router.post(
  "/upload",
  upload.array("photos", 10),
  uploadController.uploadFiles
);

/**
 * @route   DELETE /upload/delete-image
 * @desc    Delete a file
 * @access  Private (add auth middleware if needed)
 */
router.delete("/upload/delete-image", uploadController.deleteFile);

export default router;
