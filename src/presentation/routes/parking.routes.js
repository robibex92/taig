import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import {
  authenticateJWT,
  authenticateOptional,
} from "../middlewares/authMiddleware.js";
import { requireRoles } from "../../core/middlewares/checkRole.js";
import { validateRequest } from "../../core/validation/validator.js";
import {
  assignOwnerSchema,
  createParkingSpotSchema,
  parkingMessageSchema,
  parkingNoteSchema,
  updateParkingSpotSchema,
} from "../../core/validation/schemas/parking.schema.js";
import {
  PARKING_ADMIN_ROLES,
  RESIDENT_DATA_ROLES,
} from "../../core/utils/roles.js";

const router = express.Router();
const parkingController = container.resolve("parkingController");

/**
 * Администратор паркинга; глобальный администратор — тоже (иначе он видит
 * вкладку «Парковка», но все её запросы получают 403).
 */
const parkingAdmin = requireRoles(...PARKING_ADMIN_ROLES);

/**
 * Персонал, которому видны данные жителя: администратор, модератор,
 * администратор паркинга — ровно `canViewResidentData`, тем же списком ролей.
 */
const staffViewer = requireRoles(...RESIDENT_DATA_ROLES);

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
  parkingAdmin,
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
  validateRequest(updateParkingSpotSchema),
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
  parkingAdmin,
  validateRequest(assignOwnerSchema),
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
  validateRequest(parkingMessageSchema),
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
router.post(
  BASE_ROUTE,
  authenticateJWT,
  parkingAdmin,
  validateRequest(createParkingSpotSchema),
  parkingController.createParkingSpot
);

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
  parkingAdmin,
  parkingController.unassignOwner
);

/**
 * @swagger
 * /api-v1/parking-spots/{id}/notes:
 *   get:
 *     summary: Service notes of a parking spot (staff only)
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notes with author and date
 *       403:
 *         description: Forbidden (not staff)
 */
router.get(
  `${BASE_ROUTE}/:id/notes`,
  authenticateJWT,
  staffViewer,
  parkingController.getSpotNotes
);

/**
 * @swagger
 * /api-v1/parking-spots/{id}/notes:
 *   post:
 *     summary: Add a service note to a parking spot (staff only)
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Note created
 *       400:
 *         description: Empty note
 *       403:
 *         description: Forbidden (not staff)
 */
router.post(
  `${BASE_ROUTE}/:id/notes`,
  authenticateJWT,
  staffViewer,
  validateRequest(parkingNoteSchema),
  parkingController.addSpotNote
);

/**
 * @swagger
 * /api-v1/parking-spots/notes/{noteId}:
 *   delete:
 *     summary: Delete a service note (staff only)
 *     tags: [Parking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Note deleted
 *       403:
 *         description: Forbidden (not staff)
 *       404:
 *         description: Note not found
 */
router.delete(
  `${BASE_ROUTE}/notes/:noteId`,
  authenticateJWT,
  staffViewer,
  parkingController.deleteSpotNote
);

export default router;
