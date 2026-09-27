import crypto from "crypto";
import { AuthenticationError, ValidationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Передача входа из Telegram-бота в браузер (схема как в MAX, см. H8).
 *
 * Сайт генерирует одноразовый `requestId`, открывает `t.me/<bot>?start=login_<id>`,
 * и пока страница ждёт, бот получает `/start` уже с проверенным Telegram-ом
 * идентификатором пользователя (`ctx.from`). После этого браузер забирает сессию
 * либо поллингом по `requestId`, либо переходом по кнопке «Открыть сайт» с `code`.
 *
 * Личность подтверждает сам Telegram (сообщение пришло из бот-апдейта), поэтому
 * верификация initData здесь не нужна — в отличие от виджета входа, который
 * остаётся отдельным путём (`AuthenticateUserUseCase.execute`).
 */
export class LoginHandoffUseCase {
  static REQUEST_KIND = "tg-request";
  static CODE_KIND = "tg-code";
  static TTL_MS = 5 * 60 * 1000;
  static KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

  constructor(userRepository, authenticateUserUseCase, sessionIssuer, handoffRepository) {
    this.userRepository = userRepository;
    this.authenticateUserUseCase = authenticateUserUseCase;
    this.sessionIssuer = sessionIssuer;
    this.handoffs = handoffRepository;
  }

  _normalizeKey(value, label) {
    if (typeof value !== "string" || !LoginHandoffUseCase.KEY_RE.test(value)) {
      throw new ValidationError(`Некорректный ${label}`);
    }

    return value;
  }

  /**
   * Бот получил `/start login_<requestId>`: привязываем пользователя и готовим
   * оба способа забрать сессию — поллинг сайтом и кнопку со ссылкой.
   *
   * @param {object} telegramUser — `ctx.from` (id, username, first_name, last_name)
   * @returns {Promise<{code: string, requestId: string|null}>}
   */
  async issueForTelegramUser(telegramUser, { requestId = null } = {}) {
    if (!telegramUser || telegramUser.id == null) {
      throw new AuthenticationError("Telegram user is missing");
    }

    const user = await this.authenticateUserUseCase.findOrCreateTelegramUser({
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
    });

    const code = crypto.randomBytes(32).toString("hex");

    await this.handoffs.put({
      kind: LoginHandoffUseCase.CODE_KIND,
      key: code,
      userId: user.user_id,
      ttlMs: LoginHandoffUseCase.TTL_MS,
    });

    let normalizedRequestId = null;

    if (
      typeof requestId === "string" &&
      LoginHandoffUseCase.KEY_RE.test(requestId)
    ) {
      normalizedRequestId = requestId;

      await this.handoffs.put({
        kind: LoginHandoffUseCase.REQUEST_KIND,
        key: normalizedRequestId,
        userId: user.user_id,
        ttlMs: LoginHandoffUseCase.TTL_MS,
      });
    }

    logger.info("Telegram login handoff issued", {
      user_id: user.user_id,
      telegram_id: telegramUser.id,
      hasRequestId: Boolean(normalizedRequestId),
    });

    return { code, requestId: normalizedRequestId };
  }

  /**
   * Обмен одноразового `code` или `requestId` на сессию браузера.
   * Строка удаляется вместе с чтением, поэтому вторичный обмен не пройдёт.
   */
  async claim({ requestId = null, code = null }, deviceInfo = {}, rememberMe = false) {
    let userId = null;

    if (requestId) {
      userId = await this.handoffs.consume(
        LoginHandoffUseCase.REQUEST_KIND,
        this._normalizeKey(requestId, "login request id")
      );
    } else if (code) {
      userId = await this.handoffs.consume(
        LoginHandoffUseCase.CODE_KIND,
        this._normalizeKey(code, "login code")
      );
    }

    if (!userId) {
      throw new AuthenticationError("Login request not found or expired");
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    logger.info("Telegram login handoff claimed", { user_id: user.user_id });

    return this.sessionIssuer.issue({ user, deviceInfo, rememberMe });
  }
}
