import express from "express";
import { authenticateJWT } from "../../core/middlewares/authMiddleware.js";
import { checkRole } from "../../core/middlewares/checkRole.js";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();

// Get admin controller from DI container
const adminController = container.resolve("adminController");

// Apply authentication and admin role check to all routes
router.use(authenticateJWT);
router.use(checkRole("admin"));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination and filters
 * @access  Private (admin only)
 */
router.get("/users", adminController.getAllUsers);

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update user role (user/moderator/admin)
 * @access  Private (admin only)
 */
router.patch("/users/:id/role", adminController.updateUserRole);

/**
 * @route   GET /api/admin/statistics
 * @desc    Get system statistics
 * @access  Private (admin only)
 */
router.get("/statistics", adminController.getStatistics);

export default router;
