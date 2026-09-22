import { AuthenticationError, AuthorizationError } from "../errors/AppError.js";
import { hasAnyRole, isBlocked } from "../utils/roles.js";

/**
 * Role-Based Access Control middleware.
 *
 * Usage: requireRoles(SERVICE_ROLES.PARKING_ADMIN, GLOBAL_ROLES.ADMIN)
 * An empty call only requires an unblocked, authenticated user.
 */
export const requireRoles = (...allowedRoles) => (req, res, next) => {
  const user = req.user;

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  if (isBlocked(user)) {
    throw new AuthorizationError("Account is blocked");
  }

  if (allowedRoles.length > 0 && !hasAnyRole(user, allowedRoles)) {
    throw new AuthorizationError(`Access denied. Required role(s): ${allowedRoles.join(", ")}`);
  }

  next();
};
