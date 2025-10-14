import { TokenService } from "../../application/services/TokenService.js";
import { AuthenticationError } from "../../core/errors/AppError.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";

const tokenService = new TokenService();

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AuthenticationError("No token provided");
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    throw new AuthenticationError("Invalid token format");
  }

  const decoded = tokenService.verifyToken(token);

  if (!decoded || !decoded.id) {
    throw new AuthenticationError("Invalid token");
  }

  req.user = { user_id: decoded.id };
  next();
});

/**
 * Middleware for optional authentication
 */
export const authenticateOptional = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = tokenService.verifyToken(token);
    req.user = decoded ? { user_id: decoded.id } : null;
  } catch (error) {
    req.user = null;
  }

  next();
});

/**
 * Middleware for conditional authentication (alias for authenticateOptional)
 */
export const authenticateConditional = authenticateOptional;

/**
 * Alias for authenticateJWT (for backward compatibility)
 */
export const authenticate = authenticateJWT;

/**
 * Middleware to authorize based on roles
 * @param {...string} allowedRoles - Array of allowed roles
 */
export const authorize = (...allowedRoles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError("Authentication required");
    }

    // If no roles specified, just check if user is authenticated
    if (allowedRoles.length === 0) {
      return next();
    }

    // Check if user has required role (using status field)
    const userRole = req.user.status || "user";
    if (!allowedRoles.includes(userRole)) {
      throw new AuthenticationError(
        `Access denied. Required role: ${allowedRoles.join(" or ")}`
      );
    }

    next();
  });
};
