import crypto from "crypto";
import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

export class AuthenticateMaxUserUseCase {
  constructor(
    userRepository,
    tokenService,
    refreshTokenRepository
  ) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;

    this._loginCodes = new Map();
    this.LOGIN_CODE_TTL_MS = 5 * 60 * 1000;

    this._pendingRequests = new Map();
    this.REQUEST_TTL_MS = 5 * 60 * 1000;
  }

  _sweepLoginCodes() {
    const now = Date.now();

    for (const [code, entry] of this._loginCodes) {
      if (entry.expiresAt <= now) {
        this._loginCodes.delete(code);
      }
    }
  }

  _sweepPendingRequests() {
    const now = Date.now();

    for (const [requestId, entry] of this._pendingRequests) {
      if (entry.expiresAt <= now) {
        this._pendingRequests.delete(requestId);
      }
    }
  }

  createLoginCode(userId) {
    this._sweepLoginCodes();

    const code = crypto
      .randomBytes(32)
      .toString("hex");

    this._loginCodes.set(code, {
      userId,
      expiresAt:
        Date.now() + this.LOGIN_CODE_TTL_MS,
    });

    return code;
  }

  createLoginRequest(requestId, userId) {
    if (
      typeof requestId !== "string" ||
      !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)
    ) {
      return false;
    }

    this._sweepPendingRequests();

    this._pendingRequests.set(requestId, {
      userId,
      expiresAt:
        Date.now() + this.REQUEST_TTL_MS,
    });

    return true;
  }

  async claimLoginRequest(
    requestId,
    deviceInfo = {},
    rememberMe = false
  ) {
    if (
      typeof requestId !== "string" ||
      !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)
    ) {
      throw new AuthenticationError(
        "Invalid MAX login request"
      );
    }

    const entry =
      this._pendingRequests.get(requestId);

    this._pendingRequests.delete(requestId);

    if (!entry) {
      throw new AuthenticationError(
        "Login request not found or expired"
      );
    }

    if (entry.expiresAt <= Date.now()) {
      throw new AuthenticationError(
        "Login request has expired"
      );
    }

    const user =
      await this.userRepository.findById(
        entry.userId
      );

    if (!user) {
      throw new AuthenticationError(
        "User not found"
      );
    }

    logger.info("MAX login request claimed", {
      user_id: user.user_id,
      requestId,
    });

    return this.issueSession(
      user,
      deviceInfo,
      rememberMe
    );
  }

  async claimLoginCode(
    code,
    deviceInfo = {},
    rememberMe = false
  ) {
    if (
      typeof code !== "string" ||
      code.length < 8
    ) {
      throw new AuthenticationError(
        "Invalid MAX login code"
      );
    }

    const entry =
      this._loginCodes.get(code);

    this._loginCodes.delete(code);

    if (!entry) {
      throw new AuthenticationError(
        "Login code is invalid or has expired"
      );
    }

    if (entry.expiresAt <= Date.now()) {
      throw new AuthenticationError(
        "Login code has expired"
      );
    }

    const user =
      await this.userRepository.findById(
        entry.userId
      );

    if (!user) {
      throw new AuthenticationError(
        "User not found"
      );
    }

    logger.info("MAX login code claimed", {
      user_id: user.user_id,
    });

    return this.issueSession(
      user,
      deviceInfo,
      rememberMe
    );
  }

  /**
   * Проверка MAX WebAppData.
   *
   * MAX:
   *
   * secret_key =
   * HMAC-SHA256("WebAppData", BOT_TOKEN)
   *
   * hash =
   * HMAC-SHA256(secret_key, launch_params)
   */
  verifyInitData(initData) {
    const botToken =
      process.env.MAX_BOT_TOKEN;

    if (!botToken) {
      throw new AuthenticationError(
        "MAX authentication is not configured"
      );
    }

    if (
      typeof initData !== "string" ||
      !initData.trim()
    ) {
      return {
        valid: false,
        user: null,
        authDate: null,
      };
    }

    const rawPairs = initData.split("&");

    const params = [];

    for (const pair of rawPairs) {
      const separator = pair.indexOf("=");

      if (separator <= 0) {
        return {
          valid: false,
          user: null,
          authDate: null,
        };
      }

      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);

      params.push([key, value]);
    }

    /**
     * Каждый параметр должен встречаться только один раз.
     */
    const seenKeys = new Set();

    for (const [key] of params) {
      if (seenKeys.has(key)) {
        return {
          valid: false,
          user: null,
          authDate: null,
        };
      }

      seenKeys.add(key);
    }

    const hashEntries =
      params.filter(([key]) => key === "hash");

    if (hashEntries.length !== 1) {
      return {
        valid: false,
        user: null,
        authDate: null,
      };
    }

    const originalHashRaw =
      hashEntries[0][1];

    let originalHash;

    try {
      originalHash =
        decodeURIComponent(
          originalHashRaw
        );
    } catch {
      return {
        valid: false,
        user: null,
        authDate: null,
      };
    }

    /**
     * hash должен быть SHA-256 hex:
     * 64 hex-символа.
     */
    if (!/^[a-f0-9]{64}$/i.test(originalHash)) {
      return {
        valid: false,
        user: null,
        authDate: null,
      };
    }

    const decoded = [];

    try {
      for (const [key, value] of params) {
        decoded.push([
          key,
          decodeURIComponent(value),
        ]);
      }
    } catch {
      return {
        valid: false,
        user: null,
        authDate: null,
      };
    }

    const launchParams = decoded
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(([key, value]) =>
        `${key}=${value}`
      )
      .join("\n");

    const secretKey = crypto
      .createHmac(
        "sha256",
        "WebAppData"
      )
      .update(botToken)
      .digest();

    const calculatedHash =
      crypto
        .createHmac(
          "sha256",
          secretKey
        )
        .update(launchParams)
        .digest("hex");

    const valid =
      crypto.timingSafeEqual(
        Buffer.from(
          calculatedHash,
          "hex"
        ),
        Buffer.from(
          originalHash,
          "hex"
        )
      );

    const userRaw =
      decoded.find(
        ([key]) => key === "user"
      )?.[1];

    const authDateRaw =
      decoded.find(
        ([key]) => key === "auth_date"
      )?.[1];

    let user = null;

    try {
      user = userRaw
        ? JSON.parse(userRaw)
        : null;
    } catch {
      user = null;
    }

    const authDate =
      authDateRaw
        ? Number(authDateRaw)
        : null;

    return {
      valid,
      user,
      authDate:
        Number.isFinite(authDate)
          ? authDate
          : null,
    };
  }

  /**
   * MAX рекомендует ограничивать срок initData.
   *
   * 1 час.
   */
  isAuthDateValid(
    authDate,
    maxAgeSeconds = 60 * 60
  ) {
    if (
      typeof authDate !== "number" ||
      !Number.isFinite(authDate)
    ) {
      return false;
    }

    const currentTime =
      Math.floor(Date.now() / 1000);

    const age =
      currentTime - authDate;

    /**
     * Будущая дата также подозрительна.
     */
    if (age < 0) {
      return false;
    }

    return age <= maxAgeSeconds;
  }

  async issueSession(
    user,
    deviceInfo = {},
    rememberMe = false
  ) {
    if (user.isBanned()) {
      throw new AuthenticationError(
        "User account is banned"
      );
    }

    /**
     * MAX login становится основной сессией:
     * старые refresh tokens удаляем.
     */
    await this.refreshTokenRepository
      .revokeAllForUser(
        user.user_id
      );

    await this.userRepository
      .clearRefreshToken(
        user.user_id
      );

    const {
      accessToken,
      refreshToken,
    } =
      this.tokenService.generateTokenPair(
        user,
        deviceInfo,
        rememberMe
      );

    const decodedRefresh =
      this.tokenService.decodeToken(
        refreshToken
      );

    if (
      !decodedRefresh?.jti
    ) {
      throw new AuthenticationError(
        "Failed to create refresh token"
      );
    }

    const expirationSeconds =
      this.tokenService
        .getRefreshTokenExpiration(
          rememberMe
        );

    const expiresAt =
      new Date(
        Date.now() +
          expirationSeconds * 1000
      );

    await this.refreshTokenRepository.create({
      user_id: user.user_id,
      token: refreshToken,
      jti: decodedRefresh.jti,

      device_fingerprint:
        deviceInfo &&
        Object.keys(deviceInfo).length > 0
          ? this.tokenService
              ._hashDeviceInfo(
                deviceInfo
              )
          : null,

      ip_address:
        deviceInfo.ip || null,

      user_agent:
        deviceInfo.userAgent || null,

      device_info: deviceInfo,

      expires_at: expiresAt,
    });

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  async findOrCreateMaxUser(maxUser) {
    if (
      !maxUser ||
      maxUser.id == null
    ) {
      throw new AuthenticationError(
        "MAX user id is missing"
      );
    }

    /**
     * MAX id должен сохраняться как BigInt.
     */
    const maxId =
      BigInt(maxUser.id);

    let user =
      await this.userRepository
        .findByMaxId(maxId);

    const maxFields = {
      max_id: maxId,
      max_username:
        maxUser.username || null,
      max_first_name:
        maxUser.first_name || null,
      max_last_name:
        maxUser.last_name || null,
      max_avatar:
        maxUser.photo_url || null,
    };

    if (user) {
      await this.userRepository.update(
        user.user_id,
        maxFields
      );

      return this.userRepository.findById(
        user.user_id
      );
    }

    /**
     * Не даём MAX ID конфликтовать
     * с существующим user_id.
     */
    const collision =
      await this.userRepository.findById(
        maxId
      );

    const userId =
      collision
        ? undefined
        : maxId;

    user =
      await this.userRepository.create({
        ...(userId != null
          ? { user_id: userId }
          : {}),

        telegram_id: null,

        username:
          maxUser.username || null,

        first_name:
          maxUser.first_name || "MAX",

        last_name:
          maxUser.last_name || null,

        avatar:
          maxUser.photo_url || null,

        ...maxFields,
      });

    logger.info(
      "New MAX user registered",
      {
        user_id: user.user_id,
        max_id: maxId.toString(),
      }
    );

    return user;
  }

  async execute(
    initData,
    deviceInfo = {},
    rememberMe = false,
    requestId = null
  ) {
    if (!initData) {
      throw new AuthenticationError(
        "MAX initData is required"
      );
    }

    const {
      valid,
      user: maxUser,
      authDate,
    } =
      this.verifyInitData(
        initData
      );

    if (
      !valid ||
      !maxUser ||
      maxUser.id == null
    ) {
      logger.warn(
        "Invalid MAX authentication attempt",
        {
          ip: deviceInfo.ip,
        }
      );

      throw new AuthenticationError(
        "Invalid MAX authentication"
      );
    }

    if (
      !this.isAuthDateValid(
        authDate
      )
    ) {
      throw new AuthenticationError(
        "Authentication data expired"
      );
    }

    const user =
      await this.findOrCreateMaxUser(
        maxUser
      );

    const session =
      await this.issueSession(
        user,
        deviceInfo,
        rememberMe
      );

    if (requestId) {
      this.createLoginRequest(
        requestId,
        user.user_id
      );
    }

    return {
      ...session,
      loginCode:
        this.createLoginCode(
          user.user_id
        ),
    };
  }
}