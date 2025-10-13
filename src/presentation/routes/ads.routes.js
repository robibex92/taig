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
import { API_PREFIX, API_VERSION } from "../../core/constants/index.js";

const router = express.Router();
const adController = container.resolve("adController");
const BASE_PATH = `${API_PREFIX}/${API_VERSION}/ads`;

// Public routes
router.get(
  BASE_PATH,
  validateRequest(getAdsQuerySchema, "query"),
  adController.getAds
);

router.get(`${BASE_PATH}/:id`, adController.getAdById);

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

export default router;
