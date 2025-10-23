import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import {
  telegramAuthSchema,
  refreshTokenSchema,
} from "../../core/validation/schemas/auth.schema.js";
import { authLimiter } from "../middlewares/securityMiddleware.js";

const router = express.Router();
const authController = container.resolve("authController");

// Public routes
router.post(
  "/auth/telegram",
  authLimiter,
  validateRequest(telegramAuthSchema, "body"),
  authController.authenticateTelegram
);

// Refresh token - no rate limit (handled by general limiter)
// We skip strict auth limiter to allow legitimate refresh attempts
router.post("/auth/refresh", authController.refreshToken);

// Protected routes
router.get("/auth/session", authenticateJWT, authController.getSession);

router.post("/auth/logout", authenticateJWT, authController.logout);

export default router;
