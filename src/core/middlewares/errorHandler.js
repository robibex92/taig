import { AppError } from "../errors/AppError.js";
import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";
import { logger } from "../utils/logger.js";

/**
 * Global error handler middleware
 */

/**
 * Ошибки разбора тела (`body-parser`) — это проблема запроса, а не авария.
 * Без этой ветки битый JSON и слишком большое тело приходили клиенту как 500
 * и ложились в лог как сбой сервиса — то есть маскировали настоящую аварию
 * среди мусорных запросов.
 */
const REQUEST_PARSE_ERRORS = {
  "entity.too.large": {
    statusCode: HTTP_STATUS.REQUEST_ENTITY_TOO_LARGE,
    code: ERROR_CODES.PAYLOAD_TOO_LARGE,
    message: "Тело запроса слишком большое",
  },
  "entity.parse.failed": {
    statusCode: HTTP_STATUS.BAD_REQUEST,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: "Тело запроса разобрано неверно (ожидается корректный JSON)",
  },
  "entity.verify.failed": {
    statusCode: HTTP_STATUS.BAD_REQUEST,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: "Тело запроса не прошло проверку",
  },
};

export const errorHandler = (err, req, res, next) => {
  const requestError = REQUEST_PARSE_ERRORS[err.type];

  // Log error
  if (err.isOperational || requestError) {
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

  if (requestError) {
    return res.status(requestError.statusCode).json({
      error: {
        message: requestError.message,
        code: requestError.code,
        statusCode: requestError.statusCode,
      },
    });
  }

  // Отказ multer — это проблема запроса, а не авария: раньше «файл больше 10 МБ»
  // и неподходящее поле доходили до клиента как 500.
  if (err.name === "MulterError") {
    const messages = {
      LIMIT_FILE_SIZE: "Файл слишком большой",
      LIMIT_FILE_COUNT: "Слишком много файлов в одном запросе",
      LIMIT_UNEXPECTED_FILE: "Файлы нужно передавать в поле photos",
    };

    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: {
        message: messages[err.code] || "Не удалось загрузить файл",
        code: ERROR_CODES.VALIDATION_ERROR,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      },
    });
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
