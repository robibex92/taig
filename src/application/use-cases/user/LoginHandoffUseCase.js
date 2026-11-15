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
  static CONFIRM_KIND = "tg-confirm";
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
   * Первый шаг входа (AR-1): `/start login_<requestId>` только СТАВИТ запрос
   * на подтверждение, но не выдаёт хендовер. Ссылку с requestId может прислать
   * кто угодно — поэтому сессия появляется лишь после явного нажатия
   * «Подтвердить» в чате бота (callback `login_confirm:<requestId>`).
   *
   * @returns {Promise<boolean>} false, если requestId некорректный
   */
  async stageForTelegramUser(telegramUser, requestId) {
    if (!telegramUser || telegramUser.id == null) {
      throw new AuthenticationError("Telegram user is missing");
    }

    if (typeof requestId !== "string" || !LoginHandoffUseCase.KEY_RE.test(requestId)) {
      return false;
    }

    const user = await this.authenticateUserUseCase.findOrCreateTelegramUser({
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
    });

    await this.handoffs.put({
      kind: LoginHandoffUseCase.CONFIRM_KIND,
      key: requestId,
      userId: user.user_id,
      ttlMs: LoginHandoffUseCase.TTL_MS,
    });

    logger.info("Telegram login staged for confirmation", {
      user_id: user.user_id,
      telegram_id: telegramUser.id,
    });

    return true;
  }

  /**
   * Второй шаг: пользователь нажал «Подтвердить» в боте. Запрос одноразовый;
   * подтверждающий должен быть тем же Telegram-аккаунтом, что и просивший.
   *
   * @returns {Promise<{code: string, requestId: string}>}
   */
  async confirmTelegramRequest(requestId, telegramUser) {
    const normalized = this._normalizeKey(requestId, "login request id");

    const userId = await this.handoffs.consume(LoginHandoffUseCase.CONFIRM_KIND, normalized);

    if (!userId) {
      throw new AuthenticationError("Login request not found or expired");
    }

    const user = await this.userRepository.findById(userId);

    if (!user || String(user.telegram_id) !== String(telegramUser?.id)) {
      throw new AuthenticationError("Login request belongs to another account");
    }

    return this.issueForTelegramUser(telegramUser, { requestId: normalized });
  }

  /** Отмена запроса кнопкой «Отмена»: гасим ожидание, хендовер не выдаётся. */
  async cancelTelegramRequest(requestId) {
    if (typeof requestId !== "string" || !LoginHandoffUseCase.KEY_RE.test(requestId)) {
      return false;
    }

    const userId = await this.handoffs.consume(LoginHandoffUseCase.CONFIRM_KIND, requestId);
    return Boolean(userId);
  }

  /**
   * Обмен одноразового `code` или `requestId` на сессию браузера.
   * Строка удаляется вместе с чтением, поэтому вторичный обмен не пройдёт.
   *
   * Если выдача сессии упала уже после consume, хендовер возвращается на место
   * (AR-18): пользователю не нужно начинать вход заново из-за сбоя БД.
   */
  async claim({ requestId = null, code = null }, deviceInfo = {}, rememberMe = false) {
    let kind = null;
    let key = null;

    if (requestId) {
      kind = LoginHandoffUseCase.REQUEST_KIND;
      key = this._normalizeKey(requestId, "login request id");
    } else if (code) {
      kind = LoginHandoffUseCase.CODE_KIND;
      key = this._normalizeKey(code, "login code");
    }

    const userId = kind ? await this.handoffs.consume(kind, key) : null;

    if (!userId) {
      throw new AuthenticationError("Login request not found or expired");
    }

    try {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new AuthenticationError("User not found");
      }

      logger.info("Telegram login handoff claimed", { user_id: user.user_id });

      return await this.sessionIssuer.issue({ user, deviceInfo, rememberMe });
    } catch (error) {
      await this.handoffs
        .put({ kind, key, userId, ttlMs: LoginHandoffUseCase.TTL_MS })
        .catch(() => {});
      throw error;
    }
  }
}
