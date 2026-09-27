import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AuthenticationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

const ISSUER = "taiginsky-api";
const AUDIENCE = "taiginsky-app";

const EXPRESSION_UNITS = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Centralized Token Service
 *
 * Подпись токена: `{id, type, device}` для access и `{id, type, jti, device}`
 * для refresh; `device` — sha256 от `userAgent|acceptLanguage`. IP в отпечаток
 * намеренно не входит: он меняется между запросами одного пользователя
 * (мобильный интернет, NAT дома), а `jti` уже делает refresh-токен уникальным.
 */
export class TokenService {
  constructor() {
    this.accessTokenSecret =
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    this.refreshTokenSecret =
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

    this.accessTokenExpiration = process.env.JWT_ACCESS_EXPIRATION || "15m";
    this.refreshTokenExpiration = process.env.JWT_REFRESH_EXPIRATION || "7d";
    this.refreshTokenLongExpiration =
      process.env.JWT_REFRESH_LONG_EXPIRATION || "30d";

    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error("JWT secrets are not defined");
    }

    if (this.accessTokenSecret === this.refreshTokenSecret) {
      logger.warn("Using same secret for access and refresh tokens");
    }

    /**
     * Отозванные access-токены. Живёт в памяти процесса: на втором инстансе PM2
     * (или после рестарта) отзыв не виден, и токен доживает до своего 15 минут.
     * Честный отзыв требует таблицы или Redis — это H0.4/E в реестре рефакторинга.
     */
    this.blacklist = new Set();
  }

  generateAccessToken(user, deviceInfo = {}) {
    return jwt.sign(
      { id: user.user_id, type: "access", device: this.hashDeviceInfo(deviceInfo) },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiration, issuer: ISSUER, audience: AUDIENCE }
    );
  }

  generateRefreshToken(user, deviceInfo = {}, rememberMe = false) {
    return jwt.sign(
      {
        id: user.user_id,
        type: "refresh",
        jti: crypto.randomUUID(),
        device: this.hashDeviceInfo(deviceInfo),
      },
      this.refreshTokenSecret,
      {
        expiresIn: rememberMe
          ? this.refreshTokenLongExpiration
          : this.refreshTokenExpiration,
        issuer: ISSUER,
        audience: AUDIENCE,
      }
    );
  }

  generateTokenPair(user, deviceInfo = {}, rememberMe = false) {
    return {
      accessToken: this.generateAccessToken(user, deviceInfo),
      refreshToken: this.generateRefreshToken(user, deviceInfo, rememberMe),
    };
  }

  verifyAccessToken(token, deviceInfo = {}) {
    return this._verify({
      token,
      secret: this.accessTokenSecret,
      expectedType: "access",
      deviceInfo,
      kind: "Access",
    });
  }

  verifyRefreshToken(token, deviceInfo = {}) {
    return this._verify({
      token,
      secret: this.refreshTokenSecret,
      expectedType: "refresh",
      deviceInfo,
      kind: "Refresh",
    });
  }

  _verify({ token, secret, expectedType, deviceInfo, kind }) {
    const revokedMessage =
      expectedType === "access"
        ? "Token has been revoked"
        : "Refresh token has been revoked";

    try {
      if (this.blacklist.has(token)) {
        throw new AuthenticationError(revokedMessage);
      }

      const decoded = jwt.verify(token, secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      if (decoded.type !== expectedType) {
        throw new AuthenticationError("Invalid token type");
      }

      this.noteDeviceMismatch(decoded, deviceInfo);

      return decoded;
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      if (error.name === "TokenExpiredError") {
        throw new AuthenticationError(`${kind} token expired`);
      }
      if (error.name === "JsonWebTokenError") {
        throw new AuthenticationError(`Invalid ${kind.toLowerCase()} token`);
      }
      throw new AuthenticationError(`${kind} token verification failed`);
    }
  }

  /**
   * Сверка отпечатка устройства — телеметрия, а не проверка: несовпадение
   * пишется в лог, токен принимается. Делать её блокирующей — отдельное
   * решение (H4.2): текущие сессии живут на двух устройствах и во встроенном
   * браузере мессенджера, где заголовок `Accept-Language` меняется между
   * запросами.
   */
  noteDeviceMismatch(decoded, deviceInfo) {
    if (!decoded?.device || !deviceInfo || Object.keys(deviceInfo).length === 0) {
      return;
    }

    if (decoded.device === this.hashDeviceInfo(deviceInfo)) return;

    logger.warn("Device fingerprint mismatch", {
      user_id: decoded.id,
      jti: decoded.jti ?? null,
    });
  }

  /**
   * Алиас для verifyAccessToken: middleware авторизации исторически зовёт его.
   */
  verifyToken(token, deviceInfo = {}) {
    return this.verifyAccessToken(token, deviceInfo);
  }

  decodeToken(token) {
    return jwt.decode(token);
  }

  revokeToken(token) {
    this.blacklist.add(token);

    logger.info("Token revoked", { token_hash: this.hashToken(token) });
  }

  isTokenRevoked(token) {
    return this.blacklist.has(token);
  }

  extractDeviceInfo(req) {
    return {
      userAgent: req.headers["user-agent"] || "",
      ip:
        req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        req.socket?.remoteAddress ||
        "",
      acceptLanguage: req.headers["accept-language"] || "",
    };
  }

  hashDeviceInfo(deviceInfo) {
    if (!deviceInfo || Object.keys(deviceInfo).length === 0) return null;

    const fingerprint = [
      deviceInfo.userAgent || "",
      deviceInfo.acceptLanguage || "",
    ].join("|");

    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  /** В лог попадает только префикс хеша: по токену можно было войти. */
  hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
  }

  getAccessTokenExpiration() {
    return this._parseExpiration(this.accessTokenExpiration);
  }

  getRefreshTokenExpiration(rememberMe = false) {
    return this._parseExpiration(
      rememberMe ? this.refreshTokenLongExpiration : this.refreshTokenExpiration
    );
  }

  /** `15m` → 900 сек; неразборчивое значение — те же 900, что и у access-токена. */
  _parseExpiration(expiration) {
    if (typeof expiration === "number") return expiration;

    const match = String(expiration).match(/^(\d+)([smhd])$/);
    if (!match) return 900;

    return Number(match[1]) * EXPRESSION_UNITS[match[2]];
  }
}

export default TokenService;
