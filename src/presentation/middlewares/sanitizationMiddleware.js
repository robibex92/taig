import xss from "xss";
import { logger } from "../../core/utils/logger.js";

/**
 * Sanitization Middleware
 * Protects against XSS attacks by sanitizing user input
 */

/**
 * XSS Protection Options
 */
const xssOptions = {
  whiteList: {
    // Allow only basic formatting (if needed)
    b: [],
    i: [],
    u: [],
    br: [],
    p: [],
    strong: [],
    em: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
};

/**
 * Sanitize a single value
 */
function sanitizeValue(value) {
  if (typeof value === "string") {
    // Remove script tags and dangerous attributes
    const sanitized = xss(value, xssOptions);

    // Additional manual sanitization
    return sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // Remove event handlers
      .replace(/on\w+\s*=\s*[^\s>]*/gi, ""); // Remove event handlers without quotes
  }

  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    const sanitized = {};
    for (const key in value) {
      sanitized[key] = sanitizeValue(value[key]);
    }
    return sanitized;
  }

  return value;
}

/**
 * Sanitize request body
 */
export const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    try {
      req.body = sanitizeValue(req.body);
      logger.debug("Request body sanitized", {
        path: req.path,
        method: req.method,
      });
    } catch (error) {
      logger.error("Error sanitizing request body", {
        error: error.message,
        path: req.path,
      });
    }
  }
  next();
};

/**
 * Sanitize query parameters
 */
export const sanitizeQuery = (req, res, next) => {
  if (req.query && typeof req.query === "object") {
    try {
      req.query = sanitizeValue(req.query);
      logger.debug("Query params sanitized", {
        path: req.path,
        method: req.method,
      });
    } catch (error) {
      logger.error("Error sanitizing query params", {
        error: error.message,
        path: req.path,
      });
    }
  }
  next();
};

/**
 * Sanitize all request data (body, query, params)
 */
export const sanitizeAll = (req, res, next) => {
  try {
    // Sanitize body
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeValue(req.body);
    }

    // Sanitize query params
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeValue(req.query);
    }

    // Sanitize URL params
    if (req.params && typeof req.params === "object") {
      req.params = sanitizeValue(req.params);
    }

    logger.debug("All request data sanitized", {
      path: req.path,
      method: req.method,
    });
  } catch (error) {
    logger.error("Error sanitizing request data", {
      error: error.message,
      path: req.path,
    });
  }

  next();
};

/**
 * Detect and log suspicious content
 */
export const detectSuspiciousContent = (req, res, next) => {
  const suspicious = [];

  // Check for common XSS patterns
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\s*\(/i,
  ];

  // Check body
  const bodyStr = JSON.stringify(req.body);
  for (const pattern of xssPatterns) {
    if (pattern.test(bodyStr)) {
      suspicious.push({ type: "body", pattern: pattern.toString() });
    }
  }

  // Check query
  const queryStr = JSON.stringify(req.query);
  for (const pattern of xssPatterns) {
    if (pattern.test(queryStr)) {
      suspicious.push({ type: "query", pattern: pattern.toString() });
    }
  }

  if (suspicious.length > 0) {
    logger.warn("Suspicious content detected", {
      path: req.path,
      method: req.method,
      userId: req.user?.user_id,
      ip: req.ip,
      patterns: suspicious,
      body: req.body,
      query: req.query,
    });

    // Optionally block the request
    // return res.status(400).json({
    //   success: false,
    //   error: 'Suspicious content detected',
    //   code: 'SUSPICIOUS_CONTENT'
    // });
  }

  next();
};

/**
 * SQL Injection Detection
 * Additional layer even though Prisma protects us
 */
export const detectSqlInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bOR\b.*=.*)/i,
    /(WAITFOR\s+DELAY)/i,
  ];

  const suspicious = [];

  // Check all string values in body, query, params
  const checkValue = (value, type) => {
    if (typeof value === "string") {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          suspicious.push({ type, pattern: pattern.toString(), value });
        }
      }
    }
  };

  // Check body
  if (req.body) {
    Object.values(req.body).forEach((val) => checkValue(val, "body"));
  }

  // Check query
  if (req.query) {
    Object.values(req.query).forEach((val) => checkValue(val, "query"));
  }

  // Check params
  if (req.params) {
    Object.values(req.params).forEach((val) => checkValue(val, "params"));
  }

  if (suspicious.length > 0) {
    logger.error("SQL Injection attempt detected", {
      path: req.path,
      method: req.method,
      userId: req.user?.user_id,
      ip: req.ip,
      patterns: suspicious,
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Block the request
    return res.status(400).json({
      success: false,
      error: "Invalid request",
      code: "INVALID_INPUT",
    });
  }

  next();
};

/**
 * Comprehensive security middleware
 * Combines all security checks
 */
export const securitySuite = [
  detectSqlInjection,
  detectSuspiciousContent,
  sanitizeAll,
];

export default sanitizeAll;
