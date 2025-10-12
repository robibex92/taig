import { AppError } from "../errors/AppError.js";
import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";
import { logger } from "../utils/logger.js";

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Log error
  if (err.isOperational) {
    logger.warn({
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.error({
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  }

  // Handle known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: {
        message: "Invalid token",
        code: ERROR_CODES.AUTHENTICATION_ERROR,
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      },
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: {
        message: "Token expired",
        code: ERROR_CODES.AUTHENTICATION_ERROR,
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      },
    });
  }

  // Handle database errors
  if (err.code && err.code.startsWith("23")) {
    return res.status(HTTP_STATUS.CONFLICT).json({
      error: {
        message: "Database constraint violation",
        code: ERROR_CODES.DATABASE_ERROR,
        statusCode: HTTP_STATUS.CONFLICT,
      },
    });
  }

  // Handle unknown errors
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
      code: ERROR_CODES.INTERNAL_ERROR,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
};

/**
 * Async handler wrapper to catch errors in async routes
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 handler
 */
export const notFoundHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: ERROR_CODES.NOT_FOUND_ERROR,
      statusCode: HTTP_STATUS.NOT_FOUND,
    },
  });
};
