const express = require("express");
const { authenticateJWT } = require("../../core/middlewares/authMiddleware");
const { checkRole } = require("../../core/middlewares/checkRole");

module.exports = (container) => {
  const router = express.Router();
  const adminController = container.get("AdminController");

  // Apply authentication and admin role check to all routes
  router.use(authenticateJWT);
  router.use(checkRole("admin"));

  /**
   * @route   GET /api/v1/admin/users
   * @desc    Get all users with pagination and filters
   * @access  Private (admin only)
   */
  router.get("/users", adminController.getAllUsers);

  /**
   * @route   PATCH /api/v1/admin/users/:id/role
   * @desc    Update user role (user/moderator/admin)
   * @access  Private (admin only)
   */
  router.patch("/users/:id/role", adminController.updateUserRole);

  /**
   * @route   GET /api/v1/admin/statistics
   * @desc    Get system statistics
   * @access  Private (admin only)
   */
  router.get("/statistics", adminController.getStatistics);

  return router;
};
