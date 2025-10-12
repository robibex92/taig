import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Improved Use case for refreshing access token
 * - Token rotation for enhanced security
 * - Device fingerprint validation
 * - Session tracking
 * - Audit logging
 */
export class RefreshTokenUseCase {
  constructor(userRepository, tokenService, refreshTokenRepository) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  async execute(refreshToken, deviceInfo = {}) {
    if (!refreshToken) {
      throw new AuthenticationError("Refresh token is required");
    }

    // Verify refresh token
    const decoded = this.tokenService.verifyRefreshToken(
      refreshToken,
      deviceInfo
    );

    if (!decoded || !decoded.id || !decoded.jti) {
      logger.warn("Invalid refresh token structure", {
        has_id: !!decoded?.id,
        has_jti: !!decoded?.jti,
      });
      throw new AuthenticationError("Invalid refresh token");
    }

    // Find token in database
    const storedToken = await this.refreshTokenRepository.findByToken(
      refreshToken
    );

    if (!storedToken) {
      logger.warn("Refresh token not found in database", {
        jti: decoded.jti,
        user_id: decoded.id,
      });
      throw new AuthenticationError("Invalid refresh token");
    }

    // Check if token is revoked
    if (storedToken.isRevoked()) {
      logger.warn("Attempt to use revoked refresh token", {
        jti: decoded.jti,
        user_id: decoded.id,
        revoked_at: storedToken.revoked_at,
      });
      throw new AuthenticationError("Refresh token has been revoked");
    }

    // Check if token is expired
    if (storedToken.isExpired()) {
      logger.warn("Attempt to use expired refresh token", {
        jti: decoded.jti,
        user_id: decoded.id,
        expires_at: storedToken.expires_at,
      });
      throw new AuthenticationError("Refresh token has expired");
    }

    // Verify device fingerprint (optional, for extra security)
    if (deviceInfo && Object.keys(deviceInfo).length > 0) {
      const currentFingerprint = this.tokenService._hashDeviceInfo(deviceInfo);
      if (
        storedToken.device_fingerprint &&
        storedToken.device_fingerprint !== currentFingerprint
      ) {
        logger.warn("Device fingerprint mismatch on refresh", {
          jti: decoded.jti,
          user_id: decoded.id,
          stored: storedToken.device_fingerprint,
          current: currentFingerprint,
        });
        // For now, we'll allow it but log the warning
        // In stricter implementations, you might want to throw an error
      }
    }

    // Find user
    const user = await this.userRepository.findById(decoded.id);

    if (!user) {
      logger.warn("User not found for refresh token", {
        jti: decoded.jti,
        user_id: decoded.id,
      });
      throw new AuthenticationError("User not found");
    }

    // Check if user is banned
    if (user.isBanned()) {
      logger.warn("Banned user refresh attempt", {
        user_id: user.user_id,
        jti: decoded.jti,
      });
      throw new AuthenticationError("User account is banned");
    }

    // TOKEN ROTATION: Generate new token pair
    const newTokens = this.tokenService.generateTokenPair(user, deviceInfo);

    // Decode new refresh token to get JTI
    const decodedNewRefresh = this.tokenService.decodeToken(
      newTokens.refreshToken
    );

    // Calculate expiration date for new refresh token
    const expirationSeconds = this.tokenService.getRefreshTokenExpiration();
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    // Revoke old refresh token (rotation)
    await this.refreshTokenRepository.revokeByJti(decoded.jti);

    // Store new refresh token
    await this.refreshTokenRepository.create({
      user_id: user.user_id,
      token: newTokens.refreshToken,
      jti: decodedNewRefresh.jti,
      device_fingerprint:
        deviceInfo && Object.keys(deviceInfo).length > 0
          ? this.tokenService._hashDeviceInfo(deviceInfo)
          : null,
      ip_address: deviceInfo.ip || null,
      user_agent: deviceInfo.userAgent || null,
      device_info: deviceInfo,
      expires_at: expiresAt,
    });

    logger.info("Access token refreshed (token rotated)", {
      user_id: user.user_id,
      old_jti: decoded.jti,
      new_jti: decodedNewRefresh.jti,
    });

    return newTokens;
  }
}
