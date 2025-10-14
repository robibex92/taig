import rateLimit from "express-rate-limit";
import helmet from "helmet";

/**
 * Helmet security middleware configuration
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

/**
 * General rate limiter
 */
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // Increased from 100 to 500
  message: {
    error: {
      message: "Too many requests from this IP, please try again later",
      code: "RATE_LIMIT_EXCEEDED",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Trust proxy for correct IP detection behind Nginx
  validate: { trustProxy: false }, // Disable validation warning
  // Skip certain endpoints from rate limiting
  skip: (req) => {
    // Skip rate limiting for refresh token endpoint to prevent lockout
    return req.path === "/api/auth/refresh";
  },
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  skipSuccessfulRequests: true,
  message: {
    error: {
      message: "Too many authentication attempts, please try again later",
      code: "AUTH_RATE_LIMIT_EXCEEDED",
    },
  },
  validate: { trustProxy: false }, // Disable validation warning
});

/**
 * Rate limiter for ad creation
 */
export const createAdLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit to 10 ads per hour
  message: {
    error: {
      message: "Too many ads created, please try again later",
      code: "CREATE_AD_RATE_LIMIT_EXCEEDED",
    },
  },
  validate: { trustProxy: false }, // Disable validation warning
});
