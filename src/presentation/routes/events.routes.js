import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";
import { checkRole } from "../../core/middlewares/checkRole.js";

const router = express.Router();
const eventController = container.resolve("eventController");

const BASE_ROUTE = "/";

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Events calendar management API
 */

/**
 * @swagger
 * /api-v1/events:
 *   get:
 *     summary: Get all events
 *     tags: [Events]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, cancelled, completed]
 *         description: Filter by status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [general, meeting, cleanup, celebration, repair]
 *         description: Filter by event type
 *     responses:
 *       200:
 *         description: List of events
 *       500:
 *         description: Internal Server Error
 */
router.get(BASE_ROUTE, eventController.getEvents);

/**
 * @swagger
 * /api-v1/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - start_date
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               event_type:
 *                 type: string
 *                 enum: [general, meeting, cleanup, celebration, repair]
 *               location:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *               max_participants:
 *                 type: integer
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Event created successfully
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
  checkRole("admin", "moderator", "activist"),
  eventController.createEvent
);

/**
 * @swagger
 * /api-v1/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Event details
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal Server Error
 */
router.get(`${BASE_ROUTE}/:id`, eventController.getEventById);

/**
 * @swagger
 * /api-v1/events/{id}:
 *   put:
 *     summary: Update event
 *     tags: [Events]
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
 *               description:
 *                 type: string
 *               event_type:
 *                 type: string
 *                 enum: [general, meeting, cleanup, celebration, repair]
 *               location:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *               max_participants:
 *                 type: integer
 *               image_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal Server Error
 */
router.put(`${BASE_ROUTE}/:id`, authenticateJWT, eventController.updateEvent);

/**
 * @swagger
 * /api-v1/events/{id}:
 *   delete:
 *     summary: Delete event
 *     tags: [Events]
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
 *         description: Event deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal Server Error
 */
router.delete(
  `${BASE_ROUTE}/:id`,
  authenticateJWT,
  eventController.deleteEvent
);

/**
 * @swagger
 * /api-v1/events/{id}/register:
 *   post:
 *     summary: Register for event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Successfully registered for event
 *       400:
 *         description: Event is full or already registered
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal Server Error
 */
// Регистрация на событие - доступна как для авторизованных, так и для гостей
router.post(`${BASE_ROUTE}/:id/register`, eventController.registerForEvent);

/**
 * @swagger
 * /api-v1/events/{id}/unregister:
 *   post:
 *     summary: Unregister from event
 *     tags: [Events]
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
 *         description: Successfully unregistered from event
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal Server Error
 */
router.post(
  `${BASE_ROUTE}/:id/unregister`,
  authenticateJWT,
  eventController.unregisterFromEvent
);

export default router;
