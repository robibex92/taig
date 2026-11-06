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
 * Подпись токена: `{id, type, jti, device}` — и у access, и у refresh. Один
 * `jti` на пару — это id сессии: строка `refresh_tokens` создаётся под него при
 * входе, поэтому отзыв сессии гасит оба токена сразу и виден всем инстансам и
 * после рестарта (раньше отозванный access-токен лежал в `Set` памяти процесса
 * и на втором воркере PM2 продолжал работать; аудит S17).
 *
 * `device` — sha256 от `userAgent|acceptLanguage`. IP в отпечаток намеренно не
 * входит: он меняется между запросами одного пользователя (мобильный интернет,
 * NAT дома), а уникальность сессии обеспечивает `jti`.
 */
export class TokenService {
  constructor(sessionStore = null) {
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
     * Хранилище сессий (`refreshTokenRepository`): по `jti` отвечает, отозвана
     * ли сессия. Без него сервис работает как раньше — токен проверяется только
     * по подписи; его подставляют в DI, а тесты оставляют `null`.
     */
    this.sessionStore = sessionStore;
  }

  generateAccessToken(user, deviceInfo = {}, jti = null) {
    return jwt.sign(
      {
        id: user.user_id,
        type: "access",
        jti: jti ?? crypto.randomUUID(),
        device: this.hashDeviceInfo(deviceInfo),
      },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiration, issuer: ISSUER, audience: AUDIENCE }
    );
  }

  generateRefreshToken(user, deviceInfo = {}, rememberMe = false, jti = null) {
    return jwt.sign(
      {
        id: user.user_id,
        type: "refresh",
        jti: jti ?? crypto.randomUUID(),
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

  /**
   * Пара токенов одной сессии: оба несут один `jti`, поэтому отзыв строки
   * `refresh_tokens` выключает и access, и refresh.
   */
  generateTokenPair(user, deviceInfo = {}, rememberMe = false) {
    const jti = crypto.randomUUID();

    return {
      jti,
      accessToken: this.generateAccessToken(user, deviceInfo, jti),
      refreshToken: this.generateRefreshToken(user, deviceInfo, rememberMe, jti),
    };
  }

  /**
   * Проверка подписи без чтения сессий — синхронная. Нужна там, где токен
   * используют только как ключ (например, `rateLimitKey`), и обращаться к базе
   * в момент формирования запроса нельзя. Отозванная сессия здесь остаётся
   * «действующей»: это не пропуск в систему, а деление квоты, и безопаснее
   * знать, что за ключ, чем класть всех анонимов в одну корзину по IP дома.
   */
  verifyAccessTokenSignature(token) {
    return this._verifySignature({
      token,
      secret: this.accessTokenSecret,
      expectedType: "access",
      kind: "Access",
    });
  }

  async verifyAccessToken(token, deviceInfo = {}) {
    return this._verify({
      token,
      secret: this.accessTokenSecret,
      expectedType: "access",
      deviceInfo,
      kind: "Access",
    });
  }

  async verifyRefreshToken(token, deviceInfo = {}) {
    return this._verify({
      token,
      secret: this.refreshTokenSecret,
      expectedType: "refresh",
      deviceInfo,
      kind: "Refresh",
    });
  }

  _verifySignature({ token, secret, expectedType, kind }) {
    try {
      const decoded = jwt.verify(token, secret, {
        // Без явного списка jsonwebtoken берёт алгоритм из самого токена. Подпись
        // симметрическая, поэтому фиксируем HS256 — тот же, что в `jwt.sign`.
        algorithms: ["HS256"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      if (decoded.type !== expectedType) {
        throw new AuthenticationError("Invalid token type");
      }

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

  async _verify({ token, secret, expectedType, deviceInfo, kind }) {
    const decoded = this._verifySignature({ token, secret, expectedType, kind });

    // Отзыв смотрим уже после подписи: чужую подделку не должно быть видно
    // как «отозванную сессию».
    await this.assertNotRevokedSession(decoded, kind);

    this.noteDeviceMismatch(decoded, deviceInfo);

    return decoded;
  }

  /**
   * Сессия отозвана — токены этой сессии не принимаются.
   *
   * Строки может не оказаться (токен выпущен до того, как сессии стали
   * табличными, или база недоступна): тогда проверка не блокирует запрос —
   * подпись всё ещё обязана совпасть. Терять из-за сбоя хранилища авторизацию
   * всего дома дороже, чем окно в одну сессию, которую и так не отозвали.
   */
  async assertNotRevokedSession(decoded, kind) {
    if (!this.sessionStore || !decoded?.jti) return;

    let session;
    try {
      session = await this.sessionStore.findByJti(decoded.jti);
    } catch (error) {
      logger.warn("Не удалось прочитать сессию при проверке токена", {
        jti: decoded.jti,
        error: error.message,
      });
      return;
    }

    if (session?.is_revoked) {
      throw new AuthenticationError(
        kind === "Access" ? "Token has been revoked" : "Refresh token has been revoked"
      );
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
  async verifyToken(token, deviceInfo = {}) {
    return this.verifyAccessToken(token, deviceInfo);
  }

  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Отозвать сессию по любому токену пары: `jti` у access и refresh один, и
   * отзыв строки `refresh_tokens` выключает оба — сразу, на всех инстансах и
   * после рестарта процесса.
   */
  async revokeToken(token) {
    const decoded = this.decodeToken(token);

    if (!decoded?.jti) return false;

    if (!this.sessionStore) {
      logger.warn("Токен отзывают без хранилища сессий — отзыв виден только до рестарта", {
        jti: decoded.jti,
      });
      return false;
    }

    await this.sessionStore.revokeByJti(decoded.jti);
    logger.info("Session revoked", { jti: decoded.jti });

    return true;
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
