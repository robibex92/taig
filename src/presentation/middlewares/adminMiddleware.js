import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";

/**
 * Admin Middleware
 * Checks if user has admin privileges
 */
export const requireAdmin = asyncHandler(async (req, res, next) => {
  // Check if user is authenticated
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  // Check if user has admin status
  if (req.user.status !== "admin") {
    throw new AppError("Admin privileges required", 403);
  }

  // User is admin, proceed to next middleware
  next();
});
