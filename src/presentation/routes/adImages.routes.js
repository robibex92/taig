import express from "express";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();
const adImageController = container.resolve("adImageController");

/**
 * @route   POST /ad-images
 * @desc    Create images for ad or post
 * @access  Private (add auth middleware if needed)
 */
router.post("/ad-images", adImageController.create);

/**
 * @route   GET /ad-images
 * @desc    Get images by ad_id or post_id query param
 * @access  Public
 */
router.get("/ad-images", adImageController.getByQuery);

/**
 * @route   GET /ad-images/:id
 * @desc    Get images by ID (tries as ad_id, then post_id)
 * @access  Public
 */
router.get("/ad-images/:id", adImageController.getById);

/**
 * @route   DELETE /ad-images/:id
 * @desc    Delete single image
 * @access  Private (add auth middleware if needed)
 */
router.delete("/ad-images/:id", adImageController.deleteOne);

/**
 * @route   DELETE /ad-images
 * @desc    Delete multiple images
 * @access  Private (add auth middleware if needed)
 */
router.delete("/ad-images", adImageController.deleteMultiple);

/**
 * @route   POST /ad-images/set-main/:image_id
 * @desc    Set image as main
 * @access  Private (add auth middleware if needed)
 */
router.post("/ad-images/set-main/:image_id", adImageController.setMain);

export default router;
