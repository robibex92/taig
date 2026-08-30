import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import {
  telegramAuthSchema,
  maxAuthSchema,
  sessionIdSchema,
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

router.post(
  "/auth/max",
  authLimiter,
  validateRequest(maxAuthSchema, "body"),
  authController.authenticateMax
);

// Refresh token - no rate limit (handled by general limiter)
// We skip strict auth limiter to allow legitimate refresh attempts
router.post("/auth/refresh", authController.refreshToken);

// Protected routes
router.get("/auth/session", authenticateJWT, authController.getSession);

router.post("/auth/logout", authenticateJWT, authController.logout);

router.get("/auth/sessions", authenticateJWT, authController.getSessions);

router.delete(
  "/auth/sessions/:sessionId",
  authenticateJWT,
  validateRequest(sessionIdSchema, "params"),
  authController.revokeSession
);

router.post(
  "/auth/sessions/revoke-all",
  authenticateJWT,
  authController.revokeAllOtherSessions
);

router.post("/auth/logout-all", authenticateJWT, authController.logoutAll);

router.post(
  "/auth/link/max",
  authenticateJWT,
  validateRequest(maxAuthSchema, "body"),
  authController.linkMax
);

router.post(
  "/auth/link/telegram",
  authenticateJWT,
  validateRequest(telegramAuthSchema, "body"),
  authController.linkTelegram
);

export default router;
