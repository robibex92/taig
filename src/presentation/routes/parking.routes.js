import express from "express";
import { ParkingController } from "../controllers/ParkingController.js";
import {
  authenticateJWT,
  authenticateOptional,
} from "../middlewares/authMiddleware.js";
import { requireRoles } from "../../core/middlewares/checkRole.js";
import { SERVICE_ROLES } from "../../core/utils/roles.js";

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
 *     summary: Get all parking spots (detailed data only for parking admins)
 *     tags: [Parking]
 *     responses:
 *       200:
 *         description: List of parking spots
 *       500:
 *         description: Internal Server Error
 */
router.get(BASE_ROUTE, authenticateOptional, parkingController.getParkingSpots);

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
router.get(
  `${BASE_ROUTE}/:id`,
  authenticateOptional,
  parkingController.getParkingSpotById
);

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
  authenticateJWT,
  requireRoles(SERVICE_ROLES.PARKING_ADMIN),
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
  requireRoles(SERVICE_ROLES.PARKING_ADMIN),
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
 *     summary: Create parking spot (admins may set an owner)
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Parking spot created
 */
router.post(BASE_ROUTE, authenticateJWT, requireRoles(SERVICE_ROLES.PARKING_ADMIN), parkingController.createParkingSpot);

/**
 * @swagger
 * /api-v1/parking-spots/{id}:
 *   delete:
 *     summary: Delete parking spot (owner or parking admin)
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
 *       200:
 *         description: Parking spot deleted
 */
router.delete(
  `${BASE_ROUTE}/:id`,
  authenticateJWT,
  parkingController.deleteParkingSpot
);

/**
 * @swagger
 * /api-v1/parking-spots/{id}/unassign-owner:
 *   post:
 *     summary: Free a parking spot from its owner (parking admin only)
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
 *       200:
 *         description: Owner removed
 *       403:
 *         description: Forbidden (not a parking admin)
 */
router.post(
  "/parking/spots/:id/unassign-owner",
  authenticateJWT,
  requireRoles(SERVICE_ROLES.PARKING_ADMIN),
  parkingController.unassignOwner
);

export default router;
