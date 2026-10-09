import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Метаданные пишутся в одну строку JSON.
 *
 * `JSON.stringify` падает на BigInt, а BigInt в метаданных — это обычное дело:
 * `user_id` и `ad_id` из Prisma именно такие. Падение происходило внутри
 * логгера, то есть превращало в 500 уже успешное действие (например, установку
 * главного фото), поэтому большие числа тут же заменяются строкой, а любая
 * другая неудача сериализации — просто текстом.
 */
const stringifyMetadata = (metadata) => {
  try {
    return JSON.stringify(metadata, (_key, value) =>
      typeof value === "bigint" ? String(value) : value
    );
  } catch {
    return String(metadata);
  }
};

// Custom log format
const logFormat = printf(
  ({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${stringifyMetadata(metadata)}`;
    }

    // Add stack trace if present
    if (stack) {
      msg += `\n${stack}`;
    }

    return msg;
  }
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        logFormat
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(__dirname, "../../../logs/error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(__dirname, "../../../logs/combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create logs directory if it doesn't exist
import fs from "fs";
const logsDir = path.join(__dirname, "../../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;
