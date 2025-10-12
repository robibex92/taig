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

// Public routes
router.get(
  "/api/ads",
  validateRequest(getAdsQuerySchema, "query"),
  adController.getAds
);

router.get("/api/ads/:id", adController.getAdById);

router.post("/api/ads/:id/view_count", adController.incrementViewCount);

// Protected routes
router.post(
  "/api/ads",
  authenticateJWT,
  createAdLimiter,
  validateRequest(createAdSchema, "body"),
  adController.createAd
);

router.patch(
  "/api/ads/:id",
  authenticateJWT,
  validateRequest(updateAdSchema, "body"),
  adController.updateAd
);

router.delete("/api/ads/:id", authenticateJWT, adController.deleteAd);

export default router;
