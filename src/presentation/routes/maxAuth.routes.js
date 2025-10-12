import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/securityMiddleware.js";

const router = express.Router();
const maxAuthController = container.resolve("maxAuthController");
/**
 * @swagger
 * /api/v1/auth/max:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate via MAX Platform
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               max_id:
 *                 type: integer
 *               max_first_name:
 *                 type: string
 *               max_last_name:
 *                 type: string
 *               max_photo_url:
 *                 type: string
 *               max_platform:
 *                 type: string
 *               auth_key:
 *                 type: string
 *               auth_date:
 *                 type: integer
 *               hash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *       401:
 *         description: Invalid MAX signature
 */
router.post(
  "/max",
  authLimiter,
  maxAuthController.authenticateMax.bind(maxAuthController)
);

/**
 * @swagger
 * /api/v1/auth/link-max:
 *   post:
 *     tags: [Auth]
 *     summary: Link MAX account to existing user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               max_id:
 *                 type: integer
 *               max_first_name:
 *                 type: string
 *               max_last_name:
 *                 type: string
 *               max_photo_url:
 *                 type: string
 *               max_platform:
 *                 type: string
 *               auth_key:
 *                 type: string
 *               auth_date:
 *                 type: integer
 *               hash:
 *                 type: string
 *     responses:
 *       200:
 *         description: MAX account linked successfully
 *       409:
 *         description: Account already linked
 */
router.post(
  "/link-max",
  authenticateJWT,
  authLimiter,
  maxAuthController.linkMax.bind(maxAuthController)
);

/**
 * @swagger
 * /api/v1/auth/link-telegram:
 *   post:
 *     tags: [Auth]
 *     summary: Link Telegram account to existing MAX user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_telegram:
 *                 type: integer
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               username:
 *                 type: string
 *               photo_url:
 *                 type: string
 *               auth_date:
 *                 type: integer
 *               hash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Telegram account linked successfully
 *       409:
 *         description: Account already linked
 */
router.post(
  "/link-telegram",
  authenticateJWT,
  authLimiter,
  maxAuthController.linkTelegram.bind(maxAuthController)
);

/**
 * @swagger
 * /api/v1/auth/unlink-platform:
 *   post:
 *     tags: [Auth]
 *     summary: Unlink platform from user account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [telegram, max]
 *     responses:
 *       200:
 *         description: Platform unlinked successfully
 *       400:
 *         description: Cannot unlink - user must have at least one platform
 */
router.post(
  "/unlink-platform",
  authenticateJWT,
  authLimiter,
  maxAuthController.unlinkPlatform.bind(maxAuthController)
);

/**
 * @swagger
 * /api/v1/auth/settings:
 *   patch:
 *     tags: [Auth]
 *     summary: Update platform settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               primary_platform:
 *                 type: string
 *                 enum: [telegram, max]
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Invalid platform or platforms not linked
 */
router.patch(
  "/settings",
  authenticateJWT,
  maxAuthController.updateSettings.bind(maxAuthController)
);

/**
 * @swagger
 * /api/v1/auth/platforms:
 *   get:
 *     tags: [Auth]
 *     summary: Get user's linked platforms info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platforms info retrieved
 */
router.get(
  "/platforms",
  authenticateJWT,
  maxAuthController.getPlatforms.bind(maxAuthController)
);

export default router;
