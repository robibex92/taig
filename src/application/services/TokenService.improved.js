import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AuthenticationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

export class TokenService {
  constructor() {
    this.accessTokenSecret =
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET;

    this.refreshTokenSecret =
      process.env.JWT_REFRESH_SECRET ||
      process.env.JWT_SECRET;

    this.accessTokenExpiration =
      process.env.JWT_ACCESS_EXPIRATION ||
      "15m";

    this.refreshTokenExpiration =
      process.env.JWT_REFRESH_EXPIRATION ||
      "7d";

    this.refreshTokenLongExpiration =
      process.env.JWT_REFRESH_LONG_EXPIRATION ||
      "30d";

    if (
      !this.accessTokenSecret ||
      !this.refreshTokenSecret
    ) {
      throw new Error(
        "JWT secrets are not defined"
      );
    }

    if (
      this.accessTokenSecret ===
      this.refreshTokenSecret
    ) {
      logger.warn(
        "Using same secret for access and refresh tokens"
      );
    }

    this.blacklist = new Set();
  }

  generateAccessToken(
    user,
    deviceInfo = {}
  ) {
    const payload = {
      id: user.user_id,
      type: "access",
      status:
        user.status || "active",

      device:
        this._hashDeviceInfo(
          deviceInfo
        ),
    };

    return jwt.sign(
      payload,
      this.accessTokenSecret,
      {
        expiresIn:
          this.accessTokenExpiration,

        issuer:
          "taiginsky-api",

        audience:
          "taiginsky-app",
      }
    );
  }

  generateRefreshToken(
    user,
    deviceInfo = {},
    rememberMe = false
  ) {
    const payload = {
      id: user.user_id,
      type: "refresh",

      jti: crypto.randomUUID(),

      device:
        this._hashDeviceInfo(
          deviceInfo
        ),
    };

    const expiration =
      rememberMe
        ? this.refreshTokenLongExpiration
        : this.refreshTokenExpiration;

    return jwt.sign(
      payload,
      this.refreshTokenSecret,
      {
        expiresIn: expiration,

        issuer:
          "taiginsky-api",

        audience:
          "taiginsky-app",
      }
    );
  }

  generateTokenPair(
    user,
    deviceInfo = {},
    rememberMe = false
  ) {
    return {
      accessToken:
        this.generateAccessToken(
          user,
          deviceInfo
        ),

      refreshToken:
        this.generateRefreshToken(
          user,
          deviceInfo,
          rememberMe
        ),
    };
  }

  verifyAccessToken(
    token,
    deviceInfo = {}
  ) {
    try {
      if (this.blacklist.has(token)) {
        throw new AuthenticationError(
          "Token has been revoked"
        );
      }

      const decoded =
        jwt.verify(
          token,
          this.accessTokenSecret,
          {
            issuer:
              "taiginsky-api",

            audience:
              "taiginsky-app",
          }
        );

      if (
        decoded.type !== "access"
      ) {
        throw new AuthenticationError(
          "Invalid token type"
        );
      }

      this._checkDevice(
        decoded,
        deviceInfo
      );

      return decoded;
    } catch (error) {
      if (
        error instanceof
        AuthenticationError
      ) {
        throw error;
      }

      if (
        error.name ===
        "TokenExpiredError"
      ) {
        throw new AuthenticationError(
          "Access token expired"
        );
      }

      if (
        error.name ===
        "JsonWebTokenError"
      ) {
        throw new AuthenticationError(
          "Invalid access token"
        );
      }

      throw new AuthenticationError(
        "Access token verification failed"
      );
    }
  }

  verifyRefreshToken(
    token,
    deviceInfo = {}
  ) {
    try {
      if (this.blacklist.has(token)) {
        throw new AuthenticationError(
          "Refresh token has been revoked"
        );
      }

      const decoded =
        jwt.verify(
          token,
          this.refreshTokenSecret,
          {
            issuer:
              "taiginsky-api",

            audience:
              "taiginsky-app",
          }
        );

      if (
        decoded.type !== "refresh"
      ) {
        throw new AuthenticationError(
          "Invalid token type"
        );
      }

      this._checkDevice(
        decoded,
        deviceInfo
      );

      return decoded;
    } catch (error) {
      if (
        error instanceof
        AuthenticationError
      ) {
        throw error;
      }

      if (
        error.name ===
        "TokenExpiredError"
      ) {
        throw new AuthenticationError(
          "Refresh token expired"
        );
      }

      if (
        error.name ===
        "JsonWebTokenError"
      ) {
        throw new AuthenticationError(
          "Invalid refresh token"
        );
      }

      throw new AuthenticationError(
        "Refresh token verification failed"
      );
    }
  }

  _checkDevice(
    decoded,
    deviceInfo
  ) {
    if (
      !decoded?.device ||
      !deviceInfo ||
      Object.keys(deviceInfo).length === 0
    ) {
      return;
    }

    const currentDevice =
      this._hashDeviceInfo(
        deviceInfo
      );

    if (
      decoded.device !== currentDevice
    ) {
      logger.warn(
        "Device fingerprint mismatch",
        {
          user_id: decoded.id,
        }
      );

      /**
       * Пока только мониторим.
       *
       * Не блокируем пользователя,
       * потому что IP может меняться.
       */
    }
  }

  verifyToken(
    token,
    deviceInfo = {}
  ) {
    return this.verifyAccessToken(
      token,
      deviceInfo
    );
  }

  decodeToken(token) {
    return jwt.decode(token);
  }

  revokeToken(token) {
    this.blacklist.add(token);

    logger.info(
      "Token revoked",
      {
        token_hash:
          this._hashToken(token),
      }
    );
  }

  isTokenRevoked(token) {
    return this.blacklist.has(token);
  }

  cleanupBlacklist() {
    /**
     * Для production лучше Redis.
     */
  }

  extractDeviceInfo(req) {
    return {
      userAgent:
        req.headers["user-agent"] || "",

      /**
       * IP намеренно не включаем
       * в fingerprint.
       */
      ip:
        req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        req.socket?.remoteAddress ||
        "",

      acceptLanguage:
        req.headers["accept-language"] ||
        "",
    };
  }

  _hashDeviceInfo(deviceInfo) {
    if (
      !deviceInfo ||
      Object.keys(deviceInfo).length === 0
    ) {
      return null;
    }

    const fingerprint = [
      deviceInfo.userAgent || "",
      deviceInfo.acceptLanguage || "",
    ].join("|");

    return crypto
      .createHash("sha256")
      .update(fingerprint)
      .digest("hex");
  }

  _hashToken(token) {
    return crypto
      .createHash("sha256")
      .update(token)
      .digest("hex")
      .slice(0, 16);
  }

  getAccessTokenExpiration() {
    return this._parseExpiration(
      this.accessTokenExpiration
    );
  }

  getRefreshTokenExpiration(
    rememberMe = false
  ) {
    const expiration =
      rememberMe
        ? this.refreshTokenLongExpiration
        : this.refreshTokenExpiration;

    return this._parseExpiration(
      expiration
    );
  }

  _parseExpiration(exp) {
    if (
      typeof exp === "number"
    ) {
      return exp;
    }

    const match =
      String(exp).match(
        /^(\d+)([smhd])$/
      );

    if (!match) {
      return 900;
    }

    const [, value, unit] =
      match;

    const multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return (
      Number(value) *
      multipliers[unit]
    );
  }
}