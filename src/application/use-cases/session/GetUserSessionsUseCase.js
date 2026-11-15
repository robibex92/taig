import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for getting all user sessions
 * Shows active and recent sessions for security monitoring
 */
export class GetUserSessionsUseCase {
  constructor(refreshTokenRepository) {
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * @param {string|null} currentJti — jti текущей сессии из проверенного
   *   access-токена (AR-16); у GET-запроса тела нет.
   */
  async execute(userId, currentJti = null) {
    // Get all active sessions
    const sessions = await this.refreshTokenRepository.findByUserId(userId);

    // Format sessions for response
    const formattedSessions = sessions.map((session) => {
      const sessionData = session.toJSON();
      sessionData.is_current = Boolean(currentJti) && session.jti === currentJti;
      return sessionData;
    });

    logger.info("User sessions retrieved", {
      user_id: userId,
      session_count: sessions.length,
    });

    return formattedSessions;
  }
}
