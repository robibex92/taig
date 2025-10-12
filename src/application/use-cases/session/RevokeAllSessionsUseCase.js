import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for revoking all sessions except current
 * "Logout from all other devices" feature
 */
export class RevokeAllSessionsUseCase {
  constructor(refreshTokenRepository, tokenService) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
  }

  async execute(userId, currentToken) {
    // Get current session JTI
    let currentJti = null;
    if (currentToken) {
      try {
        const decoded = this.tokenService.decodeToken(currentToken);
        currentJti = decoded?.jti;
      } catch (error) {
        logger.warn("Could not decode current token", { user_id: userId });
      }
    }

    // Revoke all sessions except current
    if (currentJti) {
      await this.refreshTokenRepository.revokeAllExcept(userId, currentJti);
      logger.info("All sessions except current revoked", {
        user_id: userId,
        kept_jti: currentJti,
      });
    } else {
      // If no current token, revoke all
      await this.refreshTokenRepository.revokeAllForUser(userId);
      logger.info("All sessions revoked", {
        user_id: userId,
      });
    }

    return {
      success: true,
      message: "All other sessions have been logged out",
    };
  }
}
