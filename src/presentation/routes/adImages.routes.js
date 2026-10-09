import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();
const adImageController = container.resolve("adImageController");

/**
 * Фотографии объявлений и заметок.
 *
 * Чтение — публичное (картинки видны в ленте), запись — только с токеном и
 * только по своим объектам: право «чей это снимок» решает `imageAccess` в
 * кейсах, потому что целей четыре и вход у них разный.
 */

/**
 * @route   POST /ad-images
 * @desc    Create images for ad or post
 * @access  Private (author of the ad, moderator for posts)
 */
router.post("/ad-images", authenticateJWT, adImageController.create);

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
 * @access  Private
 */
router.delete("/ad-images/:id", authenticateJWT, adImageController.deleteOne);

/**
 * @route   DELETE /ad-images
 * @desc    Delete multiple images
 * @access  Private
 */
router.delete("/ad-images", authenticateJWT, adImageController.deleteMultiple);

/**
 * @route   POST /ad-images/set-main/:image_id
 * @desc    Set image as main
 * @access  Private
 */
router.post(
  "/ad-images/set-main/:image_id",
  authenticateJWT,
  adImageController.setMain
);

export default router;
