import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Rotation refresh-токена.
 *
 * Пару токенов и строку в `refresh_tokens` создаёт `SessionIssuer` — как в
 * Telegram- и MAX-логине; здесь к этому добавляется только проверка старого
 * токена и отзыв его `jti`.
 */
export class RefreshTokenUseCase {
  constructor(userRepository, tokenService, refreshTokenRepository, sessionIssuer) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;
    this.sessionIssuer = sessionIssuer;
  }

  async execute(refreshToken, deviceInfo = {}) {
    if (!refreshToken) {
      throw new AuthenticationError("Refresh token is required");
    }

    const decoded = this.tokenService.verifyRefreshToken(refreshToken, deviceInfo);

    if (!decoded?.id || !decoded?.jti) {
      throw new AuthenticationError("Invalid refresh token");
    }

    const storedToken = await this.refreshTokenRepository.findByToken(
      refreshToken
    );

    if (!storedToken) {
      throw new AuthenticationError("Invalid refresh token");
    }

    if (storedToken.isRevoked()) {
      logger.warn("Attempt to use revoked refresh token", {
        jti: decoded.jti,
        user_id: decoded.id,
      });
      throw new AuthenticationError("Refresh token has been revoked");
    }

    if (storedToken.isExpired()) {
      throw new AuthenticationError("Refresh token has expired");
    }

    const user = await this.userRepository.findById(decoded.id);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    /**
     * Срок нового токена наследуется от старого: long-lived сессия («запомнить
     * меня») не должна после rotation превращаться в недельную.
     */
    const rememberMe = this._wasLongLived(storedToken);

    await this.refreshTokenRepository.revokeByJti(decoded.jti);

    const tokens = await this.sessionIssuer.issue({
      user,
      deviceInfo,
      rememberMe,
    });

    logger.info("Access token refreshed", {
      user_id: user.user_id,
      old_jti: decoded.jti,
      new_jti: tokens.jti,
      remember_me: rememberMe,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  _wasLongLived(storedToken) {
    const tokenService = this.sessionIssuer.tokenService;
    const remainingMs =
      new Date(storedToken.expires_at).getTime() - Date.now();
    const normalLifetimeMs = tokenService.getRefreshTokenExpiration() * 1000;

    return remainingMs > normalLifetimeMs * 1.5;
  }
}
