import express from "express";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();
const adImageController = container.resolve("adImageController");

/**
 * @route   POST /api/v1/ad-images
 * @desc    Create images for ad or post
 * @access  Private (add auth middleware if needed)
 */
router.post("/api/v1/ad-images", adImageController.create);

/**
 * @route   GET /api/v1/ad-images
 * @desc    Get images by ad_id or post_id query param
 * @access  Public
 */
router.get("/api/v1/ad-images", adImageController.getByQuery);

/**
 * @route   GET /api/v1/ad-images/:id
 * @desc    Get images by ID (tries as ad_id, then post_id)
 * @access  Public
 */
router.get("/api/v1/ad-images/:id", adImageController.getById);

/**
 * @route   DELETE /api/v1/ad-images/:id
 * @desc    Delete single image
 * @access  Private (add auth middleware if needed)
 */
router.delete("/api/v1/ad-images/:id", adImageController.deleteOne);

/**
 * @route   DELETE /api/v1/ad-images
 * @desc    Delete multiple images
 * @access  Private (add auth middleware if needed)
 */
router.delete("/api/v1/ad-images", adImageController.deleteMultiple);

/**
 * @route   POST /api/v1/ad-images/set-main/:image_id
 * @desc    Set image as main
 * @access  Private (add auth middleware if needed)
 */
router.post("/api/v1/ad-images/set-main/:image_id", adImageController.setMain);

export default router;
