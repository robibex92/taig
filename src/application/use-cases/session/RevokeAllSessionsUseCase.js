import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for revoking all sessions except current
 * "Logout from all other devices" feature
 */
export class RevokeAllSessionsUseCase {
  constructor(refreshTokenRepository) {
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * @param {string|null} currentJti — jti текущей сессии из проверенного
   *   access-токена (AR-16). Без него отзываются ВСЕ сессии (logout-all).
   */
  async execute(userId, currentJti) {
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
