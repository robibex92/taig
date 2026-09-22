import express from "express";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../../core/middlewares/checkRole.js";
import { GLOBAL_ROLES, SERVICE_ROLES } from "../../core/utils/roles.js";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();

// Get admin controller from DI container
const adminController = container.resolve("adminController");

// Apply authentication to all routes
router.use(authenticateJWT);

/**
 * @route   GET /api/admin/users
 * @desc    Resident directory (name + platform ids). Parking and cars admins
 *          need it to attach a place or a car to a resident.
 * @access  Private (staff, parking admin, cars admin)
 */
router.get(
  "/users",
  requireRoles(
    GLOBAL_ROLES.ADMIN,
    GLOBAL_ROLES.MODERATOR,
    SERVICE_ROLES.PARKING_ADMIN,
    SERVICE_ROLES.CARS_ADMIN
  ),
  adminController.getAllUsers
);

/**
 * @route   PATCH /api/admin/users/:id/roles
 * @desc    Replace a user's role list
 * @access  Private (admin only)
 */
router.patch(
  "/users/:id/roles",
  requireRoles(GLOBAL_ROLES.ADMIN),
  adminController.updateUserRoles
);

/**
 * @route   GET /api/admin/statistics
 * @desc    Get system statistics
 * @access  Private (admin and moderators)
 */
router.get(
  "/statistics",
  requireRoles(GLOBAL_ROLES.ADMIN, GLOBAL_ROLES.MODERATOR),
  adminController.getStatistics
);

/**
 * @route   GET /api/admin/roles
 * @desc    Catalog of assignable roles (global, services, per-house)
 * @access  Private (admin only)
 */
router.get("/roles", requireRoles(GLOBAL_ROLES.ADMIN), adminController.getRoleCatalog);

export default router;
