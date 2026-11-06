import { logger } from "../../../core/utils/logger.js";

/**
 * Improved Logout Use Case
 *
 * `jti` у access и refresh одной пары общий, поэтому один отзыв строки
 * `refresh_tokens` выключает оба токена — сразу и для всех инстансов процесса.
 * Раньше access-токен попадал только в `Set` памяти воркера, и после рестарта
 * (или на втором воркере PM2) «вышедший» пользователь оставался в системе до
 * конца жизни токена.
 */
export class LogoutUseCase {
  constructor(tokenService) {
    this.tokenService = tokenService;
  }

  async execute(userId, accessToken, refreshToken) {
    const token = refreshToken || accessToken;

    if (token) {
      try {
        const revoked = await this.tokenService.revokeToken(token);

        if (!revoked) {
          logger.warn("Сессию не удалось отозвать", { user_id: userId });
        }
      } catch (error) {
        logger.warn("Could not revoke session", {
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
