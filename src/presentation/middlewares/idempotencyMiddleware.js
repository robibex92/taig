import { prisma } from "../../infrastructure/database/prisma.js";
import { logger } from "../../core/utils/logger.js";
import crypto from "crypto";

/**
 * Idempotency Middleware
 * Prevents duplicate requests by using idempotency keys
 *
 * Usage:
 * - Frontend should send 'X-Idempotency-Key' header with unique identifier
 * - Key format: UUID or timestamp-based unique string
 * - Stores request results for 24 hours
 * - Returns cached result if same key used within time window
 */

// In-memory cache for idempotency (можно заменить на Redis)
const idempotencyCache = new Map();

// Time to live for idempotency keys (24 hours)
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

/**
 * Generate idempotency key from request data (fallback)
 */
function generateIdempotencyKey(userId, method, url, body) {
  const data = JSON.stringify({ userId, method, url, body: body || {} });
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Clean expired idempotency keys
 */
function cleanExpiredKeys() {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL) {
      idempotencyCache.delete(key);
    }
  }
}

// Clean expired keys every hour
setInterval(cleanExpiredKeys, 60 * 60 * 1000);

/**
 * Idempotency middleware
 * Apply to POST, PUT, PATCH endpoints that should be idempotent
 */
export const idempotency = (options = {}) => {
  const { ttl = IDEMPOTENCY_TTL, generateKey = null, skipPaths = [] } = options;

  return async (req, res, next) => {
    // Only apply to state-changing methods
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    // Skip certain paths
    if (skipPaths.some((path) => req.path.includes(path))) {
      return next();
    }

    // Get idempotency key from header or generate one
    let idempotencyKey = req.headers["x-idempotency-key"];

    if (!idempotencyKey && req.user) {
      // Generate key based on user, method, url, and body
      idempotencyKey = generateIdempotencyKey(
        req.user.user_id,
        req.method,
        req.path,
        req.body
      );

      logger.debug("Generated idempotency key", {
        key: idempotencyKey.substring(0, 8) + "...",
        path: req.path,
      });
    }

    // If no key can be determined, continue without idempotency
    if (!idempotencyKey) {
      return next();
    }

    // Check if this request was already processed
    const cached = idempotencyCache.get(idempotencyKey);

    if (cached) {
      const age = Date.now() - cached.timestamp;

      // If cached response is still valid
      if (age < ttl) {
        logger.info("Idempotent request detected - returning cached response", {
          key: idempotencyKey.substring(0, 8) + "...",
          age: `${Math.round(age / 1000)}s`,
          path: req.path,
          userId: req.user?.user_id,
        });

        // Return cached response
        return res.status(cached.statusCode).json(cached.body);
      } else {
        // Cached response expired, remove it
        idempotencyCache.delete(idempotencyKey);
      }
    }

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    let statusCode = 200;

    // Override status to capture status code
    res.status = function (code) {
      statusCode = code;
      return originalStatus(code);
    };

    // Override json to cache successful responses
    res.json = function (body) {
      // Only cache successful responses (2xx)
      if (statusCode >= 200 && statusCode < 300) {
        idempotencyCache.set(idempotencyKey, {
          statusCode,
          body,
          timestamp: Date.now(),
        });

        logger.debug("Cached idempotent response", {
          key: idempotencyKey.substring(0, 8) + "...",
          statusCode,
          path: req.path,
        });
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * Strict idempotency middleware for critical operations
 * Requires X-Idempotency-Key header
 */
export const strictIdempotency = (options = {}) => {
  return async (req, res, next) => {
    const idempotencyKey = req.headers["x-idempotency-key"];

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: "X-Idempotency-Key header is required for this operation",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      });
    }

    // Validate key format (should be UUID or similar)
    const keyPattern = /^[a-zA-Z0-9_-]{8,128}$/;
    if (!keyPattern.test(idempotencyKey)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid idempotency key format. Use UUID or unique string (8-128 chars)",
        code: "INVALID_IDEMPOTENCY_KEY",
      });
    }

    // Apply regular idempotency logic
    return idempotency(options)(req, res, next);
  };
};

/**
 * Clear idempotency cache (useful for testing)
 */
export const clearIdempotencyCache = () => {
  idempotencyCache.clear();
  logger.info("Idempotency cache cleared");
};

export default idempotency;
