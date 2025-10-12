import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import { telegramAuthSchema } from "../../core/validation/schemas/user.schema.js";
import { authLimiter } from "../middlewares/securityMiddleware.js";

const router = express.Router();
const authController = container.resolve("authController");

// Public routes
router.post(
  "/api/auth/telegram",
  authLimiter,
  validateRequest(telegramAuthSchema, "body"),
  authController.authenticateTelegram
);

router.post("/api/auth/refresh", authController.refreshToken);

// Protected routes
router.get("/api/auth/session", authenticateJWT, authController.getSession);

router.post("/api/auth/logout", authenticateJWT, authController.logout);

export default router;
