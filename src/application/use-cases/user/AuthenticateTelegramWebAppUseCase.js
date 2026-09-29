import crypto from "crypto";
import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";
import { verifyWebAppInitData } from "../../../core/utils/webAppSignature.js";
import { LoginHandoffUseCase } from "./LoginHandoffUseCase.js";

/**
 * Вход из Telegram Mini App (того самого вебвью, что открывает бота).
 *
 * Отдельный от `AuthenticateUserUseCase` (виджет `@telegram-auth/react`) и от
 * MAX: подпись здесь — `tgWebAppData`, который клиент кладёт в URL запуска, и
 * проверяется она токеном того же бота, чей мини-апп открыт
 * (`TELEGRAM_BOT_TOKEN`). Проверка общей формы с MAX-овской вынесена в
 * `core/utils/webAppSignature.js`.
 *
 * Окно `auth_date` — то же, что у MAX и виджета (час плюс допуск на перекос
 * часов): суточное окно превращало перехваченный initData в готовый логин.
 */
export class AuthenticateTelegramWebAppUseCase {
  static AUTH_DATE_MAX_AGE_SECONDS = 3600 + 300;

  constructor(authenticateUserUseCase, sessionIssuer, handoffRepository) {
    this.authenticateUserUseCase = authenticateUserUseCase;
    this.sessionIssuer = sessionIssuer;
    this.handoffs = handoffRepository;
  }

  #isFresh(authDate) {
    if (authDate == null) {
      return false;
    }

    return Date.now() / 1000 - authDate <= AuthenticateTelegramWebAppUseCase.AUTH_DATE_MAX_AGE_SECONDS;
  }

  /**
   * @param {string} initData содержимое `tgWebAppData` как есть
   * @param {string|null} requestId необязательный `login_…` из запуска: даёт
   *   браузеру забрать этот вход поллингом (`/api/auth/telegram/claim`).
   */
  async execute(initData, { requestId = null } = {}, deviceInfo = {}, rememberMe = false) {
    const verified = verifyWebAppInitData(
      initData,
      process.env.TELEGRAM_BOT_TOKEN
    );

    if (!verified.valid) {
      logger.warn("Invalid Telegram Mini App authentication", {
        ip: deviceInfo.ip,
        reason: verified.reason,
      });

      throw new AuthenticationError("Invalid Telegram Mini App authentication");
    }

    const telegramUser = verified.user;

    if (!telegramUser?.id) {
      logger.warn("Telegram Mini App data has no user", {
        ip: deviceInfo.ip,
        reason: verified.reason,
      });

      throw new AuthenticationError("Telegram user is missing in launch data");
    }

    if (!this.#isFresh(verified.authDate)) {
      logger.warn("Telegram Mini App data expired", {
        ip: deviceInfo.ip,
        authDate: verified.authDate,
      });

      throw new AuthenticationError("Authentication data expired");
    }

    const user = await this.authenticateUserUseCase.findOrCreateTelegramUser(telegramUser);

    const session = await this.sessionIssuer.issue({ user, deviceInfo, rememberMe });

    /**
     * Хендоверы в ту же таблицу и с теми же kind'ами, что у входа через бота:
     * код даёт ссылку «Продолжить в браузере» (`?tg_login=…`), а `requestId` —
     * поллинг вкладкой сайта, если мини-апп открыли с обычного сайта.
     */
    const code = this.#randomKey();

    await this.handoffs.put({
      kind: LoginHandoffUseCase.CODE_KIND,
      key: code,
      userId: user.user_id,
      ttlMs: LoginHandoffUseCase.TTL_MS,
    });

    if (requestId && LoginHandoffUseCase.KEY_RE.test(requestId)) {
      await this.handoffs.put({
        kind: LoginHandoffUseCase.REQUEST_KIND,
        key: requestId,
        userId: user.user_id,
        ttlMs: LoginHandoffUseCase.TTL_MS,
      });
    }

    logger.info("Telegram Mini App authenticated", {
      user_id: user.user_id,
      telegram_id: telegramUser.id,
      key_variant: verified.keyVariant,
      hasRequestId: Boolean(requestId && LoginHandoffUseCase.KEY_RE.test(requestId)),
    });

    return { ...session, loginCode: code };
  }

  #randomKey() {
    return crypto.randomBytes(32).toString("hex");
  }
}
