import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT, authenticateOptional } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import {
  createAdSchema,
  updateAdSchema,
  getAdsQuerySchema,
  adIdParamSchema,
} from "../../core/validation/schemas/ad.schema.js";
import { createAdLimiter } from "../middlewares/securityMiddleware.js";
const router = express.Router();
const adController = container.resolve("adController");
const BASE_PATH = "/ads";

// Public routes
router.get(
  BASE_PATH,
  authenticateOptional,
  validateRequest(getAdsQuerySchema, "query"),
  adController.getAds
);

/**
 * Кто смотрит объявление решает его видимость: активное открыто всем, снятое и
 * удалённое — только автору и модерации (см. `GetAdByIdUseCase`), поэтому
 * маршруту нужен необязательный токен, а не полный отказ гостю.
 */
router.get(
  `${BASE_PATH}/:id`,
  authenticateOptional,
  validateRequest(adIdParamSchema, "params"),
  adController.getAdById
);

// Get ad images (alias for /ad-images/:id for convenience)
router.get(`${BASE_PATH}/:id/images`, async (req, res, next) => {
  const adImageController = container.resolve("adImageController");
  return adImageController.getById(req, res, next);
});

// Get telegram messages for an ad
router.get(
  `${BASE_PATH}/:id/telegram-messages`,
  authenticateJWT,
  adController.getTelegramMessages
);

router.post(
  `${BASE_PATH}/:id/view_count`,
  authenticateOptional,
  validateRequest(adIdParamSchema, "params"),
  adController.incrementViewCount
);

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

// «Отметить актуальность»: сдвигает срок авто-архива (владелец или модератор)
router.post(
  `${BASE_PATH}/:id/relevant`,
  authenticateJWT,
  validateRequest(adIdParamSchema, "params"),
  adController.markRelevant
);

// Permanently delete ad (only for already deleted ads)
router.delete(
  `${BASE_PATH}/:id/permanent`,
  authenticateJWT,
  adController.permanentDeleteAd
);

// Delete ad image
router.post(
  `${BASE_PATH}/delete-image`,
  authenticateJWT,
  async (req, res, next) => {
    const adImageController = container.resolve("adImageController");
    return adImageController.deleteByUrl(req, res, next);
  }
);

export default router;
