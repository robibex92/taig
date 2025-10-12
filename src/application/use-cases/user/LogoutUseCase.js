import { logger } from "../../../core/utils/logger.js";

/**
 * Improved Logout Use Case
 * - Revokes refresh token in database
 * - Adds access token to blacklist
 * - Proper audit logging
 */
export class LogoutUseCase {
  constructor(refreshTokenRepository, tokenService) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
  }

  async execute(userId, accessToken, refreshToken) {
    // Revoke access token (add to blacklist)
    if (accessToken) {
      this.tokenService.revokeToken(accessToken);
    }

    // Revoke refresh token in database
    if (refreshToken) {
      try {
        const decoded = this.tokenService.decodeToken(refreshToken);
        if (decoded?.jti) {
          await this.refreshTokenRepository.revokeByJti(decoded.jti);
        }
      } catch (error) {
        logger.warn("Could not revoke refresh token", {
          user_id: userId,
          error: error.message,
        });
      }
    }

    logger.info("User logged out", {
      user_id: userId,
    });

    return {
      success: true,
      message: "Logged out successfully",
    };
  }
}
