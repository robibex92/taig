import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";

const router = express.Router();
const bannerController = container.resolve("bannerController");

const BASE_ROUTE = "/banners";

/**
 * @swagger
 * tags:
 *   name: Banners
 *   description: Banner management API
 */

/**
 * @swagger
 * /api-v1/banners:
 *   get:
 *     summary: Get all banners
 *     tags: [Banners]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: position
 *         schema:
 *           type: string
 *           enum: [top_vertical, right_sidebar]
 *         description: Filter by position
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of banners
 *       500:
 *         description: Internal Server Error
 */
// Публичный маршрут - БЕЗ авторизации
router.get(BASE_ROUTE, (req, res, next) => {
  console.log("🎯 Banners GET route hit - NO AUTH REQUIRED");
  bannerController.getBanners(req, res, next);
});

/**
 * @swagger
 * /api-v1/banners:
 *   post:
 *     summary: Create a new banner
 *     tags: [Banners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image_url
 *               - position
 *             properties:
 *               title:
 *                 type: string
 *               image_url:
 *                 type: string
 *               link_url:
 *                 type: string
 *               position:
 *                 type: string
 *                 enum: [top_vertical, right_sidebar]
 *               is_active:
 *                 type: boolean
 *                 default: true
 *               display_order:
 *                 type: integer
 *                 default: 0
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Banner created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
router.post(
  BASE_ROUTE,
  authenticateJWT,
  requireAdmin,
  bannerController.createBanner
);

/**
 * @swagger
 * /api-v1/banners/{id}:
 *   get:
 *     summary: Get banner by ID
 *     tags: [Banners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Banner details
 *       404:
 *         description: Banner not found
 *       500:
 *         description: Internal Server Error
 */
router.get(`${BASE_ROUTE}/:id`, bannerController.getBannerById);

/**
 * @swagger
 * /api-v1/banners/{id}:
 *   put:
 *     summary: Update banner
 *     tags: [Banners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               image_url:
 *                 type: string
 *               link_url:
 *                 type: string
 *               position:
 *                 type: string
 *                 enum: [top_vertical, right_sidebar]
 *               is_active:
 *                 type: boolean
 *               display_order:
 *                 type: integer
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Banner updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Banner not found
 *       500:
 *         description: Internal Server Error
 */
router.put(
  `${BASE_ROUTE}/:id`,
  authenticateJWT,
  requireAdmin,
  bannerController.updateBanner
);

/**
 * @swagger
 * /api-v1/banners/{id}:
 *   delete:
 *     summary: Delete banner
 *     tags: [Banners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Banner deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Banner not found
 *       500:
 *         description: Internal Server Error
 */
router.delete(
  `${BASE_ROUTE}/:id`,
  authenticateJWT,
  requireAdmin,
  bannerController.deleteBanner
);

/**
 * @swagger
 * /api-v1/banners/{id}/status:
 *   patch:
 *     summary: Update banner status
 *     tags: [Banners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Banner status updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Banner not found
 *       500:
 *         description: Internal Server Error
 */
router.patch(
  `${BASE_ROUTE}/:id/status`,
  authenticateJWT,
  requireAdmin,
  bannerController.toggleBannerStatus
);

/**
 * @swagger
 * /api-v1/banners/{id}/click:
 *   post:
 *     summary: Track banner click
 *     tags: [Banners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Click tracked successfully
 *       404:
 *         description: Banner not found
 *       500:
 *         description: Internal Server Error
 */
router.post(`${BASE_ROUTE}/:id/click`, bannerController.clickBanner);

/**
 * @swagger
 * /api-v1/banners/{id}/view:
 *   post:
 *     summary: Track banner view
 *     tags: [Banners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: View tracked successfully
 *       404:
 *         description: Banner not found
 *       500:
 *         description: Internal Server Error
 */
router.post(`${BASE_ROUTE}/:id/view`, bannerController.trackBannerView);

export default router;
