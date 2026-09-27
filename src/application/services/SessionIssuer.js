import { AuthenticationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Выдача сессии — единственное место, где создаётся пара токенов и строка
 * `refresh_tokens` под неё.
 *
 * До этого код жил в трёх копиях (`AuthenticateUserUseCase`,
 * `AuthenticateMaxUserUseCase.issueSession`, `RefreshTokenUseCase`), и любое
 * изменение политики сессий требовало правки всех трёх.
 *
 * Политика: вход на одном устройстве НЕ выбивает остальные. Каждая сессия —
 * своя строка `refresh_tokens`; завершает их только сам пользователь
 * (`/auth/sessions`) или logout.
 */
export class SessionIssuer {
  constructor(tokenService, refreshTokenRepository) {
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * @param {object} user       entity пользователя
   * @param {object} deviceInfo из `tokenService.extractDeviceInfo(req)`
   * @param {boolean} rememberMe
   * @returns {Promise<{user: object, accessToken: string, refreshToken: string, jti: string, expiresAt: Date}>}
   */
  async issue({ user, deviceInfo = {}, rememberMe = false }) {
    if (user.isBanned()) {
      throw new AuthenticationError("User account is banned");
    }

    const { accessToken, refreshToken } = this.tokenService.generateTokenPair(
      user,
      deviceInfo,
      rememberMe
    );

    const decodedRefresh = this.tokenService.decodeToken(refreshToken);

    if (!decodedRefresh?.jti) {
      throw new AuthenticationError("Failed to create refresh token");
    }

    const expiresAt = new Date(
      Date.now() +
        this.tokenService.getRefreshTokenExpiration(rememberMe) * 1000
    );

    await this.refreshTokenRepository.create({
      user_id: user.user_id,
      token: refreshToken,
      jti: decodedRefresh.jti,
      device_fingerprint:
        deviceInfo && Object.keys(deviceInfo).length > 0
          ? this.tokenService.hashDeviceInfo(deviceInfo)
          : null,
      ip_address: deviceInfo.ip || null,
      user_agent: deviceInfo.userAgent || null,
      device_info: deviceInfo,
      expires_at: expiresAt,
    });

    logger.info("Session issued", {
      user_id: user.user_id,
      jti: decodedRefresh.jti,
      remember_me: rememberMe,
    });

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
      jti: decodedRefresh.jti,
      expiresAt,
    };
  }
}
