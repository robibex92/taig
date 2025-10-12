import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code = ERROR_CODES.INTERNAL_ERROR,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
      },
    };
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTHENTICATION_ERROR);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.AUTHORIZATION_ERROR);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(
      `${resource} not found`,
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.NOT_FOUND_ERROR
    );
  }
}

/**
 * Conflict error
 */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT_ERROR);
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message = "Database operation failed", originalError = null) {
    super(
      message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.DATABASE_ERROR,
      false
    );
    this.originalError = originalError;
  }
}
