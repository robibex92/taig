import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AuthenticationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Improved Token Service with enhanced security
 * - Separate secrets for access and refresh tokens
 * - Token rotation
 * - Token blacklist support
 * - Device fingerprinting
 * - Audit logging
 */
export class TokenService {
  constructor() {
    // Separate secrets for different token types
    this.accessTokenSecret =
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    this.refreshTokenSecret =
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

    // Token expiration times
    this.accessTokenExpiration = process.env.JWT_ACCESS_EXPIRATION || "15m";
    this.refreshTokenExpiration = process.env.JWT_REFRESH_EXPIRATION || "7d";
    this.refreshTokenLongExpiration =
      process.env.JWT_REFRESH_LONG_EXPIRATION || "30d"; // For "Remember me"

    // Validate secrets
    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error("JWT secrets are not defined in environment variables");
    }

    // Warn if using same secret (security risk)
    if (this.accessTokenSecret === this.refreshTokenSecret) {
      logger.warn(
        "Using same secret for access and refresh tokens - security risk!"
      );
    }

    // Token blacklist (in-memory for now, should use Redis in production)
    this.blacklist = new Set();
  }

  /**
   * Generate access token
   */
  generateAccessToken(user, deviceInfo = {}) {
    const payload = {
      id: user.user_id,
      type: "access",
      status: user.status || "active",
      // Device fingerprint for additional security
      device: this._hashDeviceInfo(deviceInfo),
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiration,
      issuer: "taiginsky-api",
      audience: "taiginsky-app",
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(user, deviceInfo = {}, rememberMe = false) {
    const payload = {
      id: user.user_id,
      type: "refresh",
      // Unique token ID for rotation tracking
      jti: crypto.randomUUID(),
      device: this._hashDeviceInfo(deviceInfo),
    };

    const expiration = rememberMe
      ? this.refreshTokenLongExpiration
      : this.refreshTokenExpiration;

    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: expiration,
      issuer: "taiginsky-api",
      audience: "taiginsky-app",
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(user, deviceInfo = {}, rememberMe = false) {
    const accessToken = this.generateAccessToken(user, deviceInfo);
    const refreshToken = this.generateRefreshToken(
      user,
      deviceInfo,
      rememberMe
    );

    logger.info("Token pair generated", {
      user_id: user.user_id,
      device: this._hashDeviceInfo(deviceInfo),
      remember_me: rememberMe,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token, deviceInfo = {}) {
    try {
      // Check blacklist first
      if (this.blacklist.has(token)) {
        throw new AuthenticationError("Token has been revoked");
      }

      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: "taiginsky-api",
        audience: "taiginsky-app",
      });

      // Verify token type
      if (decoded.type !== "access") {
        throw new AuthenticationError("Invalid token type");
      }

      // Verify device fingerprint (optional, for extra security)
      if (deviceInfo && Object.keys(deviceInfo).length > 0) {
        const currentDevice = this._hashDeviceInfo(deviceInfo);
        if (decoded.device && decoded.device !== currentDevice) {
          logger.warn("Device fingerprint mismatch", {
            user_id: decoded.id,
            expected: decoded.device,
            actual: currentDevice,
          });
          // Don't throw error, just log for monitoring
        }
      }

      return decoded;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      if (error.name === "TokenExpiredError") {
        throw new AuthenticationError("Access token expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new AuthenticationError("Invalid access token");
      }
      throw new AuthenticationError("Access token verification failed");
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token, deviceInfo = {}) {
    try {
      // Check blacklist
      if (this.blacklist.has(token)) {
        throw new AuthenticationError("Refresh token has been revoked");
      }

      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: "taiginsky-api",
        audience: "taiginsky-app",
      });

      // Verify token type
      if (decoded.type !== "refresh") {
        throw new AuthenticationError("Invalid token type");
      }

      // Verify device fingerprint
      if (deviceInfo && Object.keys(deviceInfo).length > 0) {
        const currentDevice = this._hashDeviceInfo(deviceInfo);
        if (decoded.device && decoded.device !== currentDevice) {
          logger.warn("Device fingerprint mismatch on refresh", {
            user_id: decoded.id,
            jti: decoded.jti,
          });
        }
      }

      return decoded;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      if (error.name === "TokenExpiredError") {
        throw new AuthenticationError("Refresh token expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new AuthenticationError("Invalid refresh token");
      }
      throw new AuthenticationError("Refresh token verification failed");
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Verify token (for backward compatibility)
   * This method verifies access tokens specifically
   */
  verifyToken(token, deviceInfo = {}) {
    return this.verifyAccessToken(token, deviceInfo);
  }

  /**
   * Add token to blacklist (for logout)
   */
  revokeToken(token) {
    this.blacklist.add(token);
    logger.info("Token revoked", {
      token_hash: this._hashToken(token),
    });
  }

  /**
   * Check if token is blacklisted
   */
  isTokenRevoked(token) {
    return this.blacklist.has(token);
  }

  /**
   * Clear expired tokens from blacklist (should run periodically)
   */
  cleanupBlacklist() {
    // In production, this should be handled by Redis TTL
    // For in-memory implementation, we can't easily determine expiration
    // So blacklist will grow - use Redis in production!
    logger.warn("Blacklist cleanup called - implement Redis for production");
  }

  /**
   * Extract device info from request
   */
  extractDeviceInfo(req) {
    return {
      userAgent: req.headers["user-agent"] || "",
      ip:
        req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        "",
      acceptLanguage: req.headers["accept-language"] || "",
    };
  }

  /**
   * Hash device info for fingerprinting
   * @private
   */
  _hashDeviceInfo(deviceInfo) {
    if (!deviceInfo || Object.keys(deviceInfo).length === 0) {
      return null;
    }

    const fingerprint = [
      deviceInfo.userAgent || "",
      deviceInfo.ip || "",
      deviceInfo.acceptLanguage || "",
    ].join("|");

    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  /**
   * Hash token for logging (don't log full tokens!)
   * @private
   */
  _hashToken(token) {
    return crypto
      .createHash("sha256")
      .update(token)
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * Get token expiration time in seconds
   */
  getAccessTokenExpiration() {
    return this._parseExpiration(this.accessTokenExpiration);
  }

  /**
   * Get refresh token expiration time in seconds
   */
  getRefreshTokenExpiration(rememberMe = false) {
    const exp = rememberMe
      ? this.refreshTokenLongExpiration
      : this.refreshTokenExpiration;
    return this._parseExpiration(exp);
  }

  /**
   * Parse expiration string to seconds
   * @private
   */
  _parseExpiration(exp) {
    if (typeof exp === "number") return exp;

    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const [, value, unit] = match;
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(value) * (multipliers[unit] || 1);
  }
}
