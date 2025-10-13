import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../../core/validation/validator.js";
import {
  telegramAuthSchema,
  refreshTokenSchema,
} from "../../core/validation/schemas/auth.schema.js";
import {
  authLimiter,
  refreshLimiter,
  sessionLimiter,
} from "../middlewares/securityMiddleware.js";
import cookieParser from "cookie-parser";

const router = express.Router();

// Enable cookie parser for refresh token handling
router.use(cookieParser());

const authController = container.resolve("authController");

/**
 * @swagger
 * /api-v1/auth/telegram:
 *   post:
 *     summary: Authenticate via Telegram
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - first_name
 *               - auth_date
 *               - hash
 *             properties:
 *               id:
 *                 type: number
 *               username:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               photo_url:
 *                 type: string
 *               auth_date:
 *                 type: number
 *               hash:
 *                 type: string
 *               remember_me:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Authentication successful
 *       401:
 *         description: Invalid authentication
 *       429:
 *         description: Too many requests
 */
router.post(
  "/telegram",
  authLimiter, // Rate limiting for auth endpoint
  validateRequest(telegramAuthSchema, "body"),
  authController.authenticateTelegram
);

/**
 * @swagger
 * /api-v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     description: Refresh token can be sent via cookie or Authorization header
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 *       429:
 *         description: Too many requests
 */
router.post(
  "/refresh",
  refreshLimiter, // Rate limiting for refresh endpoint
  authController.refreshToken
);

/**
 * @swagger
 * /api-v1/auth/session:
 *   get:
 *     summary: Get current session user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data retrieved
 *       401:
 *         description: Unauthorized
 */
router.get("/session", authenticateJWT, authController.getSession);

/**
 * @swagger
 * /api-v1/auth/logout:
 *   post:
 *     summary: Logout from current session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/logout", authenticateJWT, authController.logout);

/**
 * @swagger
 * /api-v1/auth/logout-all:
 *   post:
 *     summary: Logout from all sessions
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 *       401:
 *         description: Unauthorized
 */
router.post("/logout-all", authenticateJWT, authController.logoutAll);

/**
 * @swagger
 * /api-v1/auth/sessions:
 *   get:
 *     summary: Get all user sessions
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user sessions
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/sessions",
  authenticateJWT,
  sessionLimiter,
  authController.getSessions
);

/**
 * @swagger
 * /api-v1/auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 */
router.delete(
  "/sessions/:sessionId",
  authenticateJWT,
  sessionLimiter,
  authController.revokeSession
);

/**
 * @swagger
 * /api-v1/auth/sessions/revoke-all:
 *   post:
 *     summary: Revoke all sessions except current
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All other sessions revoked
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/sessions/revoke-all",
  authenticateJWT,
  sessionLimiter,
  authController.revokeAllOtherSessions
);

export default router;
