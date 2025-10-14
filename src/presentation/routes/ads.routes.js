import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import {
  createAdSchema,
  updateAdSchema,
  getAdsQuerySchema,
} from "../../core/validation/schemas/ad.schema.js";
import { createAdLimiter } from "../middlewares/securityMiddleware.js";
const router = express.Router();
const adController = container.resolve("adController");
const BASE_PATH = "/ads";

// Public routes
router.get(
  BASE_PATH,
  validateRequest(getAdsQuerySchema, "query"),
  adController.getAds
);

router.get(`${BASE_PATH}/:id`, adController.getAdById);

// Get ad images (alias for /ad-images/:id for convenience)
router.get(`${BASE_PATH}/:id/images`, async (req, res, next) => {
  const adImageController = container.resolve("adImageController");
  return adImageController.getById(req, res, next);
});

// Get telegram messages for an ad
router.get(
  `${BASE_PATH}/:id/telegram-messages`,
  adController.getTelegramMessages
);

router.post(`${BASE_PATH}/:id/view_count`, adController.incrementViewCount);

// Protected routes
router.post(
  BASE_PATH,
  authenticateJWT,
  createAdLimiter,
  validateRequest(createAdSchema, "body"),
  adController.createAd
);

router.patch(
  `${BASE_PATH}/:id`,
  authenticateJWT,
  validateRequest(updateAdSchema, "body"),
  adController.updateAd
);

router.delete(`${BASE_PATH}/:id`, authenticateJWT, adController.deleteAd);

// Permanently delete ad (only for already deleted ads)
router.delete(
  `${BASE_PATH}/:id/permanent`,
  authenticateJWT,
  adController.permanentDeleteAd
);

export default router;
