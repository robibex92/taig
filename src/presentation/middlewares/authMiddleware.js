import { AuthenticationError, AuthorizationError } from "../../core/errors/AppError.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { hasAnyRole, isBlocked } from "../../core/utils/roles.js";
import userRepository from "../../infrastructure/repositories/UserRepository.js";
import { container } from "../../infrastructure/container/Container.js";

/**
 * Identity as seen by every middleware/handler down the chain.
 * Platform ids travel here (and not in request bodies) so that ownership can
 * be checked against the token instead of against whatever the client sent.
 */
function toRequestUser(user) {
  return {
    user_id: user.user_id,
    roles: user.roles || [],
    username: user.username,
    first_name: user.first_name,
    telegram_id: user.telegram_id ?? null,
    max_id: user.max_id ?? null,
  };
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateJWT = asyncHandler(async (req, res, next) => {
  const tokenService = container.resolve("tokenService");
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AuthenticationError("No token provided");
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    throw new AuthenticationError("Invalid token format");
  }

  const decoded = tokenService.verifyToken(token, {
    userAgent: req.headers["user-agent"] || "",
    ip: req.ip || "",
  });

  if (!decoded || !decoded.id) {
    throw new AuthenticationError("Invalid token");
  }

  // Load full user data from database to get status field
  const user = await userRepository.findById(decoded.id);

  if (!user) {
    throw new AuthenticationError("User not found");
  }

  req.user = toRequestUser(user);

  next();
});

/**
 * Middleware for optional authentication
 */
export const authenticateOptional = asyncHandler(async (req, res, next) => {
  const tokenService = container.resolve("tokenService");
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
    const decoded = tokenService.verifyToken(token, {
      userAgent: req.headers["user-agent"] || "",
      ip: req.ip || "",
    });

    if (decoded && decoded.id) {
      // Load full user data from database
      const user = await userRepository.findById(decoded.id);

      if (user) {
        req.user = toRequestUser(user);
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
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
 * Middleware to authorize based on the user's role list.
 * @param {...string} allowedRoles - Roles from core/utils/roles.js vocabulary
 */
export const authorize = (...allowedRoles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError("Authentication required");
    }

    if (isBlocked(req.user)) {
      throw new AuthorizationError("Account is blocked");
    }

    if (allowedRoles.length > 0 && !hasAnyRole(req.user, allowedRoles)) {
      throw new AuthorizationError(
        `Access denied. Required role(s): ${allowedRoles.join(", ")}`
      );
    }

    next();
  });
};
