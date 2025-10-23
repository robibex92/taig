import crypto from "crypto";
import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Improved Use case for authenticating a user via Telegram
 * - Enhanced security with device fingerprinting
 * - Session management with refresh token storage
 * - Audit logging
 */
export class AuthenticateUserUseCase {
  constructor(userRepository, tokenService, refreshTokenRepository) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * Verify Telegram authentication data
   */
  verifyTelegramAuth(authData) {
    const { hash, ...data } = authData;
    const secret = crypto
      .createHash("sha256")
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();

    const checkString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join("\n");

    const hmac = crypto
      .createHmac("sha256", secret)
      .update(checkString)
      .digest("hex");

    // Детальное логирование для отладки
    logger.info("🔍 Hash verification details", {
      received_hash: hash,
      calculated_hash: hmac,
      check_string: checkString,
      data_keys: Object.keys(data),
      token_prefix: process.env.TELEGRAM_BOT_TOKEN?.substring(0, 20),
      hashes_match: hmac === hash,
    });

    return hmac === hash;
  }

  /**
   * Check auth_date to prevent replay attacks
   */
  isAuthDateValid(authDate, maxAgeSeconds = 86400) {
    // Default 24 hours
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime - authDate < maxAgeSeconds;
  }

  async execute(telegramAuthData, deviceInfo = {}, rememberMe = false) {
    // Детальное логирование для отладки
    logger.info("🔍 Telegram auth attempt", {
      telegram_id: telegramAuthData.id,
      auth_date: telegramAuthData.auth_date,
      hash_length: telegramAuthData.hash?.length,
      data_keys: Object.keys(telegramAuthData),
      ip: deviceInfo.ip,
    });

    // Verify Telegram authentication
    const isValidAuth = this.verifyTelegramAuth(telegramAuthData);
    logger.info("🔐 Auth verification result", { isValidAuth });

    if (!isValidAuth) {
      logger.warn("Invalid Telegram authentication attempt", {
        telegram_id: telegramAuthData.id,
        ip: deviceInfo.ip,
        received_data: telegramAuthData,
      });
      throw new AuthenticationError("Invalid Telegram authentication");
    }

    // Check auth_date to prevent replay attacks
    if (!this.isAuthDateValid(telegramAuthData.auth_date)) {
      logger.warn("Expired Telegram auth_date", {
        telegram_id: telegramAuthData.id,
        auth_date: telegramAuthData.auth_date,
      });
      throw new AuthenticationError("Authentication data expired");
    }

    const { id, username, first_name, last_name, photo_url } = telegramAuthData;

    // Find or create user
    let user = await this.userRepository.findByTelegramId(id);

    if (!user) {
      // Create new user
      user = await this.userRepository.create({
        user_id: id,
        username: username || null,
        first_name,
        last_name: last_name || null,
        avatar: photo_url || null,
      });

      logger.info("New user registered", {
        user_id: user.user_id,
        username: user.username,
        ip: deviceInfo.ip,
      });
    } else {
      // Update user data if not manually updated
      if (!user.is_manually_updated || user.is_manually_updated !== "true") {
        await this.userRepository.update(id, {
          username: username || user.username,
          telegram_first_name: first_name,
          telegram_last_name: last_name || null,
          avatar: photo_url || user.avatar,
        });

        user = await this.userRepository.findByTelegramId(id);
      }

      logger.info("User logged in", {
        user_id: user.user_id,
        username: user.username,
        ip: deviceInfo.ip,
      });
    }

    // Check if user is banned
    if (user.isBanned()) {
      logger.warn("Banned user login attempt", {
        user_id: user.user_id,
        ip: deviceInfo.ip,
      });
      throw new AuthenticationError("User account is banned");
    }

    // Check maximum active sessions (optional, for security)
    const activeSessionsCount =
      await this.refreshTokenRepository.countActiveForUser(user.user_id);
    const maxSessions = parseInt(process.env.MAX_ACTIVE_SESSIONS || "10");

    if (activeSessionsCount >= maxSessions) {
      logger.warn("Max active sessions reached", {
        user_id: user.user_id,
        active_sessions: activeSessionsCount,
      });
      // Optionally: revoke oldest session or throw error
      // For now, we'll allow it but log the warning
    }

    // Clear all existing refresh tokens for this user (force re-login)
    await this.refreshTokenRepository.revokeAllForUser(user.user_id);

    // Also clear any old refresh token from user table (legacy cleanup)
    await this.userRepository.clearRefreshToken(user.user_id);

    logger.info("Cleared existing refresh tokens for user", {
      user_id: user.user_id,
      ip: deviceInfo.ip,
    });

    // Generate tokens with device fingerprinting
    const { accessToken, refreshToken } = this.tokenService.generateTokenPair(
      user,
      deviceInfo,
      rememberMe
    );

    // Decode refresh token to get JTI
    const decodedRefresh = this.tokenService.decodeToken(refreshToken);

    // Calculate expiration date
    const expirationSeconds =
      this.tokenService.getRefreshTokenExpiration(rememberMe);
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    // Store refresh token in database
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

    logger.info("Authentication successful", {
      user_id: user.user_id,
      jti: decodedRefresh.jti,
      remember_me: rememberMe,
      expires_at: expiresAt,
    });

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }
}
