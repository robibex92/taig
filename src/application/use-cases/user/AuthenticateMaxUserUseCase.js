import crypto from "crypto";
import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

export class AuthenticateMaxUserUseCase {
  constructor(userRepository, sessionIssuer, handoffRepository) {
    this.userRepository = userRepository;
    this.sessionIssuer = sessionIssuer;
    this.handoffs = handoffRepository;

    this.LOGIN_CODE_TTL_MS = 5 * 60 * 1000;
    this.REQUEST_TTL_MS = 5 * 60 * 1000;
  }

  /**
   * Хендоверы живут в таблице `auth_handoffs`, а не в памяти процесса:
   * мини-апп и браузер могут попасть на разные инстансы PM2, а между выдачей
   * кода и его обменом спокойно попадает рестарт.
   */
  async createLoginCode(userId) {
    const code = crypto.randomBytes(32).toString("hex");

    await this.handoffs.put({
      kind: "code",
      key: code,
      userId,
      ttlMs: this.LOGIN_CODE_TTL_MS,
    });

    return code;
  }

  async createLoginRequest(requestId, userId) {
    if (
      typeof requestId !== "string" ||
      !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)
    ) {
      return false;
    }

    await this.handoffs.put({
      kind: "request",
      key: requestId,
      userId,
      ttlMs: this.REQUEST_TTL_MS,
    });

    return true;
  }

  async claimLoginRequest(requestId, deviceInfo = {}, rememberMe = false) {
    if (
      typeof requestId !== "string" ||
      !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)
    ) {
      throw new AuthenticationError("Invalid MAX login request");
    }

    const userId = await this.handoffs.consume("request", requestId);

    if (!userId) {
      throw new AuthenticationError(
        "Login request not found or expired"
      );
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    logger.info("MAX login request claimed", {
      user_id: user.user_id,
      requestId,
    });

    return this.issueSession(user, deviceInfo, rememberMe);
  }

  async claimLoginCode(code, deviceInfo = {}, rememberMe = false) {
    if (typeof code !== "string" || code.length < 8) {
      throw new AuthenticationError("Invalid MAX login code");
    }

    const userId = await this.handoffs.consume("code", code);

    if (!userId) {
      throw new AuthenticationError("Login code is invalid or has expired");
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    logger.info("MAX login code claimed", {
      user_id: user.user_id,
    });

    return this.issueSession(user, deviceInfo, rememberMe);
  }

  _emptyVerify(reason) {
    return {
      valid: false,
      user: null,
      authDate: null,
      reason,
    };
  }

  _safeDecode(value) {
    if (typeof value !== "string") {
      return value;
    }

    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      return value;
    }
  }

  _parseInitDataPairs(initData) {
    const params = [];
    const seenKeys = new Set();

    for (const pair of initData.split("&")) {
      if (!pair) {
        continue;
      }

      const separator = pair.indexOf("=");

      if (separator <= 0) {
        return { error: "malformed_pair" };
      }

      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);

      if (seenKeys.has(key)) {
        return { error: "duplicate_key" };
      }

      seenKeys.add(key);
      params.push([key, value]);
    }

    return { params };
  }

  _verifyParsedPairs(params, botToken) {
    const hashEntries = params.filter(([key]) => key === "hash");

    if (hashEntries.length !== 1) {
      return this._emptyVerify("missing_hash");
    }

    const originalHash = this._safeDecode(hashEntries[0][1]).trim();

    if (!/^[a-f0-9]{64}$/i.test(originalHash)) {
      return this._emptyVerify("invalid_hash_format");
    }

    const decoded = params.map(([key, value]) => [key, this._safeDecode(value)]);

    const launchParams = decoded
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(launchParams)
      .digest("hex");

    const valid = crypto.timingSafeEqual(
      Buffer.from(calculatedHash, "hex"),
      Buffer.from(originalHash.toLowerCase(), "hex")
    );

    const userRaw = decoded.find(([key]) => key === "user")?.[1];
    const authDateRaw = decoded.find(([key]) => key === "auth_date")?.[1];

    let user = null;

    try {
      user = userRaw ? JSON.parse(userRaw) : null;
    } catch {
      user = null;
    }

    const authDate = authDateRaw ? Number(authDateRaw) : null;

    return {
      valid,
      user,
      authDate: Number.isFinite(authDate) ? authDate : null,
      reason: valid ? "ok" : "hash_mismatch",
    };
  }

  /**
   * Проверка MAX WebAppData.
   * https://dev.max.ru/docs/webapps/validation
   *
   * secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
   * hash = hex(HMAC-SHA256(secret_key, launch_params))
   */
  verifyInitData(initData) {
    const botToken = process.env.MAX_BOT_TOKEN;

    if (!botToken) {
      throw new AuthenticationError(
        "MAX authentication is not configured"
      );
    }

    if (typeof initData !== "string" || !initData.trim()) {
      return this._emptyVerify("empty");
    }

    const candidates = [initData.trim()];
    const onceDecoded = this._safeDecode(initData.trim());

    if (onceDecoded && onceDecoded !== candidates[0]) {
      candidates.push(onceDecoded);
    }

    let last = this._emptyVerify("parse_failed");

    for (const candidate of candidates) {
      const parsed = this._parseInitDataPairs(candidate);

      if (parsed.error) {
        last = this._emptyVerify(parsed.error);
        continue;
      }

      last = this._verifyParsedPairs(parsed.params, botToken);

      if (last.valid) {
        return last;
      }
    }

    return last;
  }

  /**
   * MAX рекомендует ограничивать срок initData (1 час).
   * Допускаем небольшое расхождение часов клиента/сервера.
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

    const currentTime = Math.floor(Date.now() / 1000);
    const age = currentTime - authDate;
    const clockSkewSeconds = 5 * 60;

    if (age < -clockSkewSeconds) {
      return false;
    }

    return age <= maxAgeSeconds;
  }

  /**
   * Сессию выдаёт `SessionIssuer` — тот же код, что и для Telegram-логина и
   * rotation refresh-токена (раньше это была третья копия).
   */
  async issueSession(user, deviceInfo = {}, rememberMe = false) {
    return this.sessionIssuer.issue({
      user,
      deviceInfo,
      rememberMe,
    });
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
      reason,
    } =
      this.verifyInitData(
        initData
      );

    if (!valid) {
      logger.warn("Invalid MAX authentication attempt", {
        ip: deviceInfo.ip,
        reason,
        initDataLength: typeof initData === "string" ? initData.length : 0,
        hasHash: typeof initData === "string" && initData.includes("hash="),
      });

      throw new AuthenticationError(
        "Invalid MAX authentication"
      );
    }

    if (!maxUser || maxUser.id == null) {
      logger.warn("MAX initData verified but user is missing", {
        ip: deviceInfo.ip,
        reason,
      });

      throw new AuthenticationError(
        "MAX user is missing in initData"
      );
    }

    if (!this.isAuthDateValid(authDate)) {
      logger.warn("MAX initData expired", {
        ip: deviceInfo.ip,
        authDate,
      });

      throw new AuthenticationError(
        "Authentication data expired"
      );
    }

    const user =
      await this.findOrCreateMaxUser(
        maxUser
      );

    const session = await this.issueSession(user, deviceInfo, rememberMe);

    if (requestId) {
      await this.createLoginRequest(requestId, user.user_id);
    }

    return {
      ...session,
      loginCode: await this.createLoginCode(user.user_id),
    };
  }
}