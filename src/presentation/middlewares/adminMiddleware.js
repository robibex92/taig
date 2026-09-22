import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { isAdmin } from "../../core/utils/roles.js";

/**
 * Admin Middleware
 * Checks that the authenticated user holds global:admin
 */
export const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  if (!isAdmin(req.user)) {
    throw new AppError("Admin privileges required", 403);
  }

  next();
});
