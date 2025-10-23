import express from "express";
import { ParkingController } from "../controllers/ParkingController.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";

const router = express.Router();
const parkingController = new ParkingController();

const BASE_ROUTE = "/parking-spots";

/**
 * @swagger
 * tags:
 *   name: Parking
 *   description: Parking management API
 */

/**
 * @swagger
 * /api-v1/parking-spots:
 *   get:
 *     summary: Get all parking spots
 *     tags: [Parking]
 *     responses:
 *       200:
 *         description: List of parking spots
 *       500:
 *         description: Internal Server Error
 */
router.get(BASE_ROUTE, parkingController.getParkingSpots);

/**
 * @swagger
 * /api-v1/parking-spots/stats:
 *   get:
 *     summary: Get parking statistics
 *     tags: [Parking]
 *     responses:
 *       200:
 *         description: Parking statistics
 *       500:
 *         description: Internal Server Error
 */
router.get("/parking/stats", parkingController.getParkingStats);

/**
 * @swagger
 * /api-v1/parking-spots/{id}:
 *   get:
 *     summary: Get parking spot by ID
 *     tags: [Parking]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Parking spot details
 *       404:
 *         description: Parking spot not found
 *       500:
 *         description: Internal Server Error
 */
router.get(`${BASE_ROUTE}/:id`, parkingController.getParkingSpotById);

/**
 * @swagger
 * /api-v1/parking-spots/{id}/history:
 *   get:
 *     summary: Get parking spot history
 *     tags: [Parking]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Parking spot history
 *       404:
 *         description: Parking spot not found
 *       500:
 *         description: Internal Server Error
 */
router.get(
  `${BASE_ROUTE}/:id/history`,
  parkingController.getParkingSpotHistory
);

/**
 * @swagger
 * /api-v1/parking-spots/my-spots:
 *   get:
 *     summary: Get user's parking spots
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's parking spots
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
router.get(
  "/parking/my-spots",
  authenticateJWT,
  parkingController.getUserParkingSpots
);

/**
 * @swagger
 * /api-v1/parking-spots/{id}:
 *   put:
 *     summary: Update parking spot (owner only)
 *     tags: [Parking]
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
 *               status:
 *                 type: string
 *                 enum: [undefined, owned, for_sale, for_rent, maintenance, reserved]
 *               price:
 *                 type: string
 *               description:
 *                 type: string
 *               contactInfo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Parking spot updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not owner)
 *       404:
 *         description: Parking spot not found
 *       500:
 *         description: Internal Server Error
 */
router.put(
  `${BASE_ROUTE}/:id`,
  authenticateJWT,
  parkingController.updateParkingSpot
);

/**
 * @swagger
 * /api-v1/parking-spots/{id}/assign-owner:
 *   post:
 *     summary: Assign owner to parking spot (admin only)
 *     tags: [Parking]
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
 *               ownerId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Owner assigned successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin)
 *       404:
 *         description: Parking spot not found
 *       500:
 *         description: Internal Server Error
 */
router.post(
  "/parking/spots/:id/assign-owner",
  authenticateJWT,
  requireAdmin,
  parkingController.assignOwner
);

/**
 * @swagger
 * /api-v1/parking-spots/{id}/message:
 *   post:
 *     summary: Send message to parking spot owner
 *     tags: [Parking]
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
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Parking spot not found
 *       500:
 *         description: Internal Server Error
 */
router.post(
  "/parking/spots/:id/message",
  authenticateJWT,
  parkingController.sendMessageToOwner
);

/**
 * @swagger
 * /api-v1/parking-spots:
 *   post:
 *     summary: Create parking spot (not implemented)
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       501:
 *         description: Not implemented
 */
router.post(BASE_ROUTE, authenticateJWT, parkingController.createParkingSpot);

/**
 * @swagger
 * /api-v1/parking-spots/{id}:
 *   delete:
 *     summary: Delete parking spot (not implemented)
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       501:
 *         description: Not implemented
 */
router.delete(
  `${BASE_ROUTE}/:id`,
  authenticateJWT,
  parkingController.deleteParkingSpot
);

/**
 * @swagger
 * /api-v1/parking-spots/{id}/assign:
 *   post:
 *     summary: Assign car to parking spot (not implemented)
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       501:
 *         description: Not implemented
 */
router.post(
  `${BASE_ROUTE}/:id/assign`,
  authenticateJWT,
  parkingController.assignCarToSpot
);

/**
 * @swagger
 * /api-v1/parking-spots/{id}/free:
 *   post:
 *     summary: Free parking spot (not implemented)
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       501:
 *         description: Not implemented
 */
router.post(
  `${BASE_ROUTE}/:id/free`,
  authenticateJWT,
  parkingController.freeParkingSpot
);

export default router;
