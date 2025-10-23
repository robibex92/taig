import express from "express";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { checkRole } from "../../core/middlewares/checkRole.js";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();

// Get admin controller from DI container
const adminController = container.resolve("adminController");

// Apply authentication to all routes
router.use(authenticateJWT);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination and filters
 * @access  Private (admin and moderators)
 */
router.get(
  "/users",
  checkRole("admin", "moderator"),
  adminController.getAllUsers
);

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update user role (user/moderator/admin)
 * @access  Private (admin only)
 */
router.patch(
  "/users/:id/role",
  checkRole("admin"),
  adminController.updateUserRole
);

/**
 * @route   GET /api/admin/statistics
 * @desc    Get system statistics
 * @access  Private (admin and moderators)
 */
router.get(
  "/statistics",
  checkRole("admin", "moderator"),
  adminController.getStatistics
);

export default router;
