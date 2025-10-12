import rateLimit from "express-rate-limit";
import { logger } from "../../core/utils/logger.js";

/**
 * Rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error:
      "Too many authentication attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Auth rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      error:
        "Too many authentication attempts, please try again after 15 minutes",
    });
  },
});

/**
 * Rate limiter for token refresh endpoint
 * More permissive than auth, but still protected
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 refresh requests per windowMs
  message: {
    success: false,
    error: "Too many refresh requests, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Refresh rate limit exceeded", {
      ip: req.ip,
    });
    res.status(429).json({
      success: false,
      error: "Too many refresh requests, please try again after 15 minutes",
    });
  },
});

/**
 * Rate limiter for session management endpoints
 * Prevents abuse of session listing/revocation
 */
export const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    success: false,
    error: "Too many session requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Session rate limit exceeded", {
      ip: req.ip,
      user_id: req.user?.user_id,
    });
    res.status(429).json({
      success: false,
      error: "Too many session requests, please try again later",
    });
  },
});

/**
 * Global API rate limiter
 * Applied to all API endpoints as general protection
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: "Too many requests, please slow down",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for certain paths if needed
    return req.path.startsWith("/health") || req.path.startsWith("/metrics");
  },
  handler: (req, res) => {
    logger.warn("Global rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      error: "Too many requests, please slow down",
    });
  },
});

/**
 * Strict limiter for sensitive operations
 * (e.g., password reset, account deletion)
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 requests per hour
  message: {
    success: false,
    error: "Too many attempts, please try again after 1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Strict rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      user_id: req.user?.user_id,
    });
    res.status(429).json({
      success: false,
      error: "Too many attempts, please try again after 1 hour",
    });
  },
});
