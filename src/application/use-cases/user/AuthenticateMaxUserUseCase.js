import crypto from "crypto";
import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Authenticate via MAX Mini App initData (WebAppData).
 * @see https://dev.max.ru/docs/webapps/validation
 */
export class AuthenticateMaxUserUseCase {
  constructor(userRepository, tokenService, refreshTokenRepository) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  verifyInitData(initData) {
    const botToken = process.env.MAX_BOT_TOKEN;
    if (!botToken) {
      throw new AuthenticationError("MAX authentication is not configured");
    }

    const params = [];
    for (const pair of String(initData).split("&")) {
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      params.push([pair.slice(0, eq), pair.slice(eq + 1)]);
    }

    const hashEntries = params.filter((p) => p[0] === "hash");
    if (hashEntries.length !== 1) {
      return { valid: false, user: null, authDate: null };
    }

    const originalHash = decodeURIComponent(hashEntries[0][1]);
    const decoded = params.map(([k, v]) => [k, decodeURIComponent(v)]);
    decoded.sort((a, b) => a[0].localeCompare(b[0]));

    const launchParams = decoded
      .filter((p) => p[0] !== "hash")
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculated = crypto
      .createHmac("sha256", secretKey)
      .update(launchParams)
      .digest("hex");

    const valid =
      calculated.length === originalHash.length &&
      crypto.timingSafeEqual(
        Buffer.from(calculated, "hex"),
        Buffer.from(originalHash, "hex")
      );
    const userRaw = decoded.find((p) => p[0] === "user")?.[1];
    const authDateRaw = decoded.find((p) => p[0] === "auth_date")?.[1];
    let user = null;
    try {
      user = userRaw ? JSON.parse(userRaw) : null;
    } catch {
      user = null;
    }

    return {
      valid,
      user,
      authDate: authDateRaw ? Number(authDateRaw) : null,
    };
  }

  isAuthDateValid(authDate, maxAgeSeconds = 86400) {
    if (!authDate) return false;
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime - authDate < maxAgeSeconds;
  }

  async issueSession(user, deviceInfo = {}, rememberMe = false) {
    if (user.isBanned()) {
      throw new AuthenticationError("User account is banned");
    }

    await this.refreshTokenRepository.revokeAllForUser(user.user_id);
    await this.userRepository.clearRefreshToken(user.user_id);

    const { accessToken, refreshToken } = this.tokenService.generateTokenPair(
      user,
      deviceInfo,
      rememberMe
    );

    const decodedRefresh = this.tokenService.decodeToken(refreshToken);
    const expirationSeconds =
      this.tokenService.getRefreshTokenExpiration(rememberMe);
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    await this.refreshTokenRepository.create({
      user_id: user.user_id,
      token: refreshToken,
      jti: decodedRefresh.jti,
      device_fingerprint:
        deviceInfo && Object.keys(deviceInfo).length > 0
          ? this.tokenService._hashDeviceInfo(deviceInfo)
          : null,
      ip_address: deviceInfo.ip || null,
      user_agent: deviceInfo.userAgent || null,
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
    const maxId = maxUser.id;
    let user = await this.userRepository.findByMaxId(maxId);

    const maxFields = {
      max_id: maxId,
      max_username: maxUser.username || null,
      max_first_name: maxUser.first_name || null,
      max_last_name: maxUser.last_name || null,
      max_avatar: maxUser.photo_url || null,
    };

    if (user) {
      await this.userRepository.update(user.user_id, maxFields);
      return this.userRepository.findById(user.user_id);
    }

    const collision = await this.userRepository.findById(maxId);
    const userId = collision ? undefined : maxId;

    user = await this.userRepository.create({
      ...(userId != null ? { user_id: userId } : {}),
      telegram_id: null,
      username: maxUser.username || null,
      first_name: maxUser.first_name || "MAX",
      last_name: maxUser.last_name || null,
      avatar: maxUser.photo_url || null,
      ...maxFields,
    });

    logger.info("New MAX user registered", {
      user_id: user.user_id,
      max_id: maxId,
    });

    return user;
  }

  async execute(initData, deviceInfo = {}, rememberMe = false) {
    if (!initData) {
      throw new AuthenticationError("MAX initData is required");
    }

    const { valid, user: maxUser, authDate } = this.verifyInitData(initData);

    if (!valid || !maxUser?.id) {
      logger.warn("Invalid MAX authentication attempt", { ip: deviceInfo.ip });
      throw new AuthenticationError("Invalid MAX authentication");
    }

    if (!this.isAuthDateValid(authDate)) {
      throw new AuthenticationError("Authentication data expired");
    }

    const user = await this.findOrCreateMaxUser(maxUser);
    return this.issueSession(user, deviceInfo, rememberMe);
  }
}
