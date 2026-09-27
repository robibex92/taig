import crypto from "crypto";
import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Improved Use case for authenticating a user via Telegram
 * - Enhanced security with device fingerprinting
 * - Session management with refresh token storage
 * - Audit logging
 */
export class AuthenticateUserUseCase {
  /**
   * @param {object} sessionIssuer — выдача токенов и строки `refresh_tokens`
   *   вынесены в `SessionIssuer`, чтобы этот же код не был скопирован в MAX-логине
   *   и в rotation.
   */
  constructor(userRepository, sessionIssuer) {
    this.userRepository = userRepository;
    this.sessionIssuer = sessionIssuer;
  }

  /**
   * Verify Telegram authentication data
   */
  verifyTelegramAuth(authData) {
    const { hash, remember_me, ...data } = authData; // ИСКЛЮЧАЕМ remember_me из хеширования
    const secret = crypto
      .createHash("sha256")
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();

    const checkString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join("\n");

    const hmac = crypto
      .createHmac("sha256", secret)
      .update(checkString)
      .digest("hex");

    // Сравнение только по результату: хеши, check_string и токен в логи не пишутся,
    // иначе перехват лога даёт готовый переиспользуемый логин.
    const expected = Buffer.from(hmac, "hex");
    const received = Buffer.from(String(hash ?? ""), "hex");

    // Разная длина — сразу отказ: timingSafeEqual на неравных буферах бросает исключение.
    if (expected.length !== received.length) return false;

    return crypto.timingSafeEqual(expected, received);
  }

  /**
   * Check auth_date to prevent replay attacks
   */
  /**
   * Окно 1 час (как в MAX WebAppData) плюс допуск на перекос часов клиента.
   * Суточное окно превращало перехваченный initData в логин на целый день.
   */
  isAuthDateValid(authDate, maxAgeSeconds = 3600) {
    const currentTime = Math.floor(Date.now() / 1000);
    const skewAllowanceSeconds = 60;

    return currentTime - authDate < maxAgeSeconds + skewAllowanceSeconds;
  }

  async execute(telegramAuthData, deviceInfo = {}, rememberMe = false) {
    // Детальное логирование для отладки
    logger.info("🔍 Telegram auth attempt", {
      telegram_id: telegramAuthData.id,
      auth_date: telegramAuthData.auth_date,
      hash_length: telegramAuthData.hash?.length,
      data_keys: Object.keys(telegramAuthData),
      ip: deviceInfo.ip,
    });

    // Verify Telegram authentication
    const isValidAuth = this.verifyTelegramAuth(telegramAuthData);
    logger.info("🔐 Auth verification result", { isValidAuth });

    if (!isValidAuth) {
      // Сам хеш и payload не логируются: в окне action_date их достаточно, чтобы войти.
      logger.warn("Invalid Telegram authentication attempt", {
        telegram_id: telegramAuthData.id,
        ip: deviceInfo.ip,
      });
      throw new AuthenticationError("Invalid Telegram authentication");
    }

    // Check auth_date to prevent replay attacks
    if (!this.isAuthDateValid(telegramAuthData.auth_date)) {
      logger.warn("Expired Telegram auth_date", {
        telegram_id: telegramAuthData.id,
        auth_date: telegramAuthData.auth_date,
      });
      throw new AuthenticationError("Authentication data expired");
    }

    const user = await this.findOrCreateTelegramUser(telegramAuthData, deviceInfo);

    if (user.isBanned()) {
      logger.warn("Banned user login attempt", {
        user_id: user.user_id,
        ip: deviceInfo.ip,
      });
      throw new AuthenticationError("User account is banned");
    }

    // Сессии не ограничиваем: вход на одном устройстве не выбивает остальные.
    // Завершение — только руками пользователя (/auth/sessions) или logout.
    const session = await this.sessionIssuer.issue({
      user,
      deviceInfo,
      rememberMe,
    });

    logger.info("Authentication successful", {
      user_id: user.user_id,
      jti: session.jti,
      remember_me: rememberMe,
      expires_at: session.expiresAt,
    });

    return {
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }

  /**
   * Найти пользователя по Telegram-id или завести его.
   *
   * Вынесено из `execute`, потому что личность по Telegram-idu подтверждает не
   * только виджет входа на сайте: `/start login_…` в боте приходит уже от
   * Telegram, и пользователю незачем заходить вторично.
   */
  async findOrCreateTelegramUser(telegramAuthData, deviceInfo = {}) {
    const { id, username, first_name, last_name, photo_url } = telegramAuthData;

    let user = await this.userRepository.findByTelegramId(id);

    if (!user) {
      user = await this.userRepository.create({
        user_id: id,
        telegram_id: id,
        username: username || null,
        first_name,
        last_name: last_name || null,
        avatar: photo_url || null,
      });

      logger.info("New user registered", {
        user_id: user.user_id,
        username: user.username,
        ip: deviceInfo.ip,
      });

      return user;
    }

    // Обновляем данные, если их не правили вручную
    if (!user.is_manually_updated || user.is_manually_updated !== "true") {
      await this.userRepository.update(id, {
        username: username || user.username,
        telegram_first_name: first_name,
        telegram_last_name: last_name || null,
        avatar: photo_url || user.avatar,
      });

      user = await this.userRepository.findByTelegramId(id);
    }

    logger.info("User logged in", {
      user_id: user.user_id,
      username: user.username,
      ip: deviceInfo.ip,
    });

    return user;
  }
}
