import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

export class RefreshTokenUseCase {
  constructor(
    userRepository,
    tokenService,
    refreshTokenRepository
  ) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.refreshTokenRepository =
      refreshTokenRepository;
  }

  async execute(
    refreshToken,
    deviceInfo = {}
  ) {
    if (!refreshToken) {
      throw new AuthenticationError(
        "Refresh token is required"
      );
    }

    const decoded =
      this.tokenService.verifyRefreshToken(
        refreshToken,
        deviceInfo
      );

    if (
      !decoded ||
      !decoded.id ||
      !decoded.jti
    ) {
      throw new AuthenticationError(
        "Invalid refresh token"
      );
    }

    const storedToken =
      await this.refreshTokenRepository
        .findByToken(refreshToken);

    if (!storedToken) {
      throw new AuthenticationError(
        "Invalid refresh token"
      );
    }

    if (storedToken.isRevoked()) {
      logger.warn(
        "Attempt to use revoked refresh token",
        {
          jti: decoded.jti,
          user_id: decoded.id,
        }
      );

      throw new AuthenticationError(
        "Refresh token has been revoked"
      );
    }

    if (storedToken.isExpired()) {
      throw new AuthenticationError(
        "Refresh token has expired"
      );
    }

    const user =
      await this.userRepository.findById(
        decoded.id
      );

    if (!user) {
      throw new AuthenticationError(
        "User not found"
      );
    }

    if (user.isBanned()) {
      throw new AuthenticationError(
        "User account is banned"
      );
    }

    /**
     * Сохраняем исходный срок refresh token.
     *
     * Если старый токен был long-lived,
     * новый тоже должен быть long-lived.
     */
    const remainingMs =
      new Date(
        storedToken.expires_at
      ).getTime() - Date.now();

    const normalLifetimeMs =
      this.tokenService
        .getRefreshTokenExpiration() *
      1000;

    const rememberMe =
      remainingMs > normalLifetimeMs * 1.5;

    const newTokens =
      this.tokenService.generateTokenPair(
        user,
        deviceInfo,
        rememberMe
      );

    const decodedNewRefresh =
      this.tokenService.decodeToken(
        newTokens.refreshToken
      );

    if (
      !decodedNewRefresh?.jti
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

    /**
     * Rotation.
     */
    await this.refreshTokenRepository
      .revokeByJti(decoded.jti);

    await this.refreshTokenRepository.create({
      user_id: user.user_id,
      token: newTokens.refreshToken,
      jti: decodedNewRefresh.jti,

      device_fingerprint:
        deviceInfo &&
        Object.keys(deviceInfo).length > 0
          ? this.tokenService
              ._hashDeviceInfo(deviceInfo)
          : null,

      ip_address:
        deviceInfo.ip || null,

      user_agent:
        deviceInfo.userAgent || null,

      device_info: deviceInfo,

      expires_at: expiresAt,
    });

    logger.info(
      "Access token refreshed",
      {
        user_id: user.user_id,
        old_jti: decoded.jti,
        new_jti:
          decodedNewRefresh.jti,
        remember_me: rememberMe,
      }
    );

    return newTokens;
  }
}