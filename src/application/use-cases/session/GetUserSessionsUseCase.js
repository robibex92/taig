import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for getting all user sessions
 * Shows active and recent sessions for security monitoring
 */
export class GetUserSessionsUseCase {
  constructor(refreshTokenRepository, tokenService) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
  }

  async execute(userId, currentToken = null) {
    // Get all active sessions
    const sessions = await this.refreshTokenRepository.findByUserId(userId);

    // Determine current session based on token
    let currentJti = null;
    if (currentToken) {
      try {
        const decoded = this.tokenService.decodeToken(currentToken);
        currentJti = decoded?.jti;
      } catch (error) {
        // Ignore error, just won't mark current session
      }
    }

    // Format sessions for response
    const formattedSessions = sessions.map((session) => {
      const sessionData = session.toJSON();
      sessionData.is_current = session.jti === currentJti;
      return sessionData;
    });

    logger.info("User sessions retrieved", {
      user_id: userId,
      session_count: sessions.length,
    });

    return formattedSessions;
  }
}
