import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for revoking a specific session
 * Allows users to logout from specific devices
 */
export class RevokeSessionUseCase {
  constructor(refreshTokenRepository) {
    this.refreshTokenRepository = refreshTokenRepository;
  }

  async execute(sessionId, userId) {
    // Find session by ID
    const session = await this.refreshTokenRepository.findByJti(sessionId);

    if (!session) {
      throw new NotFoundError("Session");
    }

    // Verify session belongs to user
    if (String(session.user_id) !== String(userId)) {
      throw new NotFoundError("Session");
    }

    // Revoke session
    await this.refreshTokenRepository.revokeToken(session.id);

    logger.info("Session revoked", {
      user_id: userId,
      session_id: sessionId,
      device: session.getDeviceDescription(),
    });

    return {
      success: true,
      message: "Session revoked successfully",
    };
  }
}
