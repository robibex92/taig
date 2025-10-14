/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks if user has required role(s)
 */
export const checkRole = (...allowedRoles) => {
  return async (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    // Check if user has one of the allowed roles (using status field)
    if (!allowedRoles.includes(user.status)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};
