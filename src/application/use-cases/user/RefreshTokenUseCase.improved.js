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

    // Только подпись: отзыв проверяем по строке сессии ниже, чтобы отличить
    // «ещё не отзывали» от «отозванный токен используют повторно» (AR-5).
    const decoded = await this.tokenService.verifyRefreshTokenSignature(
      refreshToken
    );

    if (!decoded?.id || !decoded?.jti) {
      throw new AuthenticationError("Invalid refresh token");
    }

    this.tokenService.noteDeviceMismatch(decoded, deviceInfo);

    const storedToken = await this.refreshTokenRepository.findByJti(
      decoded.jti
    );

    if (!storedToken || String(storedToken.user_id) !== String(decoded.id)) {
      throw new AuthenticationError("Invalid refresh token");
    }

    /**
     * Повторное использование отозванного токена — признак кражи пары:
     * гасим все сессии пользователя, а не просто отвечаем 401.
     */
    if (storedToken.isRevoked()) {
      logger.warn("Attempt to use revoked refresh token — revoking user sessions", {
        jti: decoded.jti,
        user_id: decoded.id,
      });
      await this.refreshTokenRepository.revokeAllForUser(decoded.id);
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

    /**
     * Атомарная ротация: из двух параллельных запросов одним токеном отзыв
     * строки получает только один (count === 1). Проигравший — либо гонка
     * вкладок, либо кража; в обоих случаях семейство сессий гасится.
     */
    const revoked = await this.refreshTokenRepository.revokeIfActive(decoded.jti);

    if (!revoked) {
      logger.warn("Refresh token rotation race — revoking user sessions", {
        jti: decoded.jti,
        user_id: decoded.id,
      });
      await this.refreshTokenRepository.revokeAllForUser(decoded.id);
      throw new AuthenticationError("Refresh token has been revoked");
    }

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
