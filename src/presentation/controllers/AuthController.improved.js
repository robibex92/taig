import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { AuthenticationError, ValidationError } from "../../core/errors/AppError.js";
import { frontendEntry } from "../../core/utils/frontendUrl.js";

/**
 * Improved Auth Controller with enhanced security
 * - Device fingerprinting
 * - Session management
 * - CSRF protection (via SameSite cookies)
 * - Comprehensive audit logging
 */
export class AuthController {
  constructor({
    authenticateUserUseCase,
    refreshTokenUseCase,
    logoutUseCase,
    getUserSessionsUseCase,
    revokeSessionUseCase,
    revokeAllSessionsUseCase,
    userRepository,
    tokenService,
    authenticateMaxUserUseCase,
    linkPlatformUseCase,
    loginHandoffUseCase,
  }) {
    this.authenticateUserUseCase = authenticateUserUseCase;
    this.refreshTokenUseCase = refreshTokenUseCase;
    this.logoutUseCase = logoutUseCase;
    this.getUserSessionsUseCase = getUserSessionsUseCase;
    this.revokeSessionUseCase = revokeSessionUseCase;
    this.revokeAllSessionsUseCase = revokeAllSessionsUseCase;
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.authenticateMaxUserUseCase = authenticateMaxUserUseCase;
    this.linkPlatformUseCase = linkPlatformUseCase;
    this.loginHandoffUseCase = loginHandoffUseCase;
  }

  /**
   * Authenticate user via MAX Mini App initData
   * POST /api/auth/max
   */
  authenticateMax = asyncHandler(async (req, res) => {
    const initData = req.body?.initData;
    if (!initData) {
      throw new ValidationError("MAX initData is required");
    }

    const deviceInfo = this.tokenService.extractDeviceInfo(req);
    const rememberMe = Boolean(req.body?.remember_me);

    const requestId =
      typeof req.body?.requestId === "string" &&
      /^[A-Za-z0-9_-]{8,64}$/.test(req.body.requestId)
        ? req.body.requestId
        : null;

    const result = await this.authenticateMaxUserUseCase.execute(
      initData,
      deviceInfo,
      rememberMe,
      requestId
    );

    const responseData = {
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        loginCode: result.loginCode || null,
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    };

    res.status(HTTP_STATUS.OK).json(responseData);
  });

  /**
   * Exchange a one-time MAX login code / request for a fresh session (issued for the site)
   * POST /api/auth/max/claim
   */
  claimMax = asyncHandler(async (req, res) => {
    const code = req.body?.code;
    const requestId = req.body?.requestId;

    if (!code && !requestId) {
      throw new ValidationError("MAX login code or request is required");
    }

    const deviceInfo = this.tokenService.extractDeviceInfo(req);
    const rememberMe = Boolean(req.body?.remember_me);

    const result = requestId
      ? await this.authenticateMaxUserUseCase.claimLoginRequest(
          requestId,
          deviceInfo,
          rememberMe
        )
      : await this.authenticateMaxUserUseCase.claimLoginCode(
          code,
          deviceInfo,
          rememberMe
        );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    });
  });

  /**
   * Подтверждение входа MAX по ссылке из чата бота (AR-1).
   * GET /api/auth/max/confirm?r=<requestId>&t=<nonce>
   *
   * Одноразовый нонс знает только получатель сообщения в личном чате бота,
   * поэтому переход по ссылке — явное согласие владельца аккаунта. В ответ
   * отдаём простую HTML-страницу: ссылку открывает браузер человека, не API-клиент.
   */
  confirmMaxLogin = asyncHandler(async (req, res) => {
    const { r: requestId, t: nonce } = req.query;

    const page = (title, body) => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f8fafc;color:#0f172a}main{max-width:26rem;padding:2rem;text-align:center}a{display:inline-block;margin-top:1rem;padding:.7rem 1.4rem;background:#0d9488;color:#fff;border-radius:.6rem;text-decoration:none}</style>
</head><body><main>${body}</main></body></html>`;

    try {
      const { confirmed, code } =
        await this.authenticateMaxUserUseCase.confirmStagedLogin(requestId, nonce);

      if (!confirmed) {
        throw new AuthenticationError("Login request not found or expired");
      }

      const entry = frontendEntry(`max_login=${code}`);

      return res
        .status(HTTP_STATUS.OK)
        .type("html")
        .send(
          page(
            "Вход подтверждён",
            `<h1>✅ Вход подтверждён</h1><p>Откройте сайт — он войдёт сам.</p><a href="${entry}">Открыть сайт</a>`
          )
        );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .type("html")
          .send(
            page(
              "Ссылка устарела",
              "<h1>Ссылка устарела</h1><p>Запрос входа уже использован или истёк. Начните вход заново на сайте.</p>"
            )
          );
      }
      throw error;
    }
  });

  /**
   * Забрать сессию, заработанную в Telegram-боте: по requestId или по code
   * POST /api/auth/telegram/claim
   */
  claimTelegram = asyncHandler(async (req, res) => {
    const { requestId, code } = req.body ?? {};

    if (!requestId && !code) {
      throw new ValidationError("Нужен login code или requestId");
    }

    const deviceInfo = this.tokenService.extractDeviceInfo(req);
    const rememberMe = Boolean(req.body?.remember_me);

    const result = await this.loginHandoffUseCase.claim(
      { requestId, code },
      deviceInfo,
      rememberMe
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    });
  });

  /**
   * Link MAX identity to the current (authenticated) user
   * POST /api/auth/link/max
   */
  linkMax = asyncHandler(async (req, res) => {
    const initData = req.body?.initData;
    if (!initData) {
      throw new ValidationError("MAX initData is required");
    }

    const user = await this.linkPlatformUseCase.linkMax(
      req.user.user_id,
      initData
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: user.toJSON(),
      },
    });
  });

  /**
   * Link Telegram identity to the current (authenticated) user
   * POST /api/auth/link/telegram
   */
  linkTelegram = asyncHandler(async (req, res) => {
    const deviceInfo = this.tokenService.extractDeviceInfo(req);
    const rememberMe = Boolean(req.body?.remember_me);

    const result = await this.linkPlatformUseCase.linkTelegram(
      req.user.user_id,
      req.body,
      deviceInfo,
      rememberMe
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user.toJSON(),
        switchedToUserId: result.switchedToUserId,
        accessToken: result.accessToken !== null ? result.accessToken : undefined,
        refreshToken: result.refreshToken !== null ? result.refreshToken : undefined,
      },
    });
  });

  /**
   * Authenticate user via Telegram
   * POST /api/auth/telegram
   */
  authenticateTelegram = asyncHandler(async (req, res) => {
    const telegramData = req.body;

    // Extract device information
    const deviceInfo = this.tokenService.extractDeviceInfo(req);

    const result = await this.authenticateUserUseCase.execute(
      telegramData,
      deviceInfo,
      Boolean(req.body?.remember_me)
    );

    // В кросс-доменной среде отправляем ВСЕ в body
    const responseData = {
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken, // Всегда отправляем refresh token
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    };

    res.status(HTTP_STATUS.OK).json(responseData);
  });

  /**
   * Refresh access token - UPDATED for cross-domain
   * POST /api/auth/refresh
   */
  refreshToken = asyncHandler(async (req, res) => {
    // В кросс-доменной среде используем ТОЛЬКО body
    let refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      throw new ValidationError("Refresh token is required");
    }

    // Extract device information
    const deviceInfo = this.tokenService.extractDeviceInfo(req);

    // Refresh tokens
    const tokens = await this.refreshTokenUseCase.execute(
      refreshToken,
      deviceInfo
    );

    // В кросс-доменной среде НЕ используем куки - отправляем все в body
    const responseData = {
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken, // Всегда отправляем новый refresh token
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    };

    res.status(HTTP_STATUS.OK).json(responseData);
  });

  /**
   * Get current session user
   * GET /api/auth/session
   */
  getSession = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const user = await this.userRepository.findById(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user ? user.toJSON() : null,
    });
  });

  /**
   * Logout user (current session only)
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req, res) => {
    const userId = req.user?.user_id ?? null;

    const accessToken =
      req.headers.authorization?.split(" ")[1] || null;

    const refreshToken =
      req.body?.refreshToken ||
      req.cookies?.refreshToken ||
      null;

    /**
     * AR-13: access мог протухнуть — выход всё равно должен дойти до сервера,
     * иначе refresh-токен остаётся рабочим ещё 7–30 дней. Без действующей
     * сессии отзываем по refresh-токену, проверив его подпись.
     */
    if (!userId) {
      if (!refreshToken) {
        throw new ValidationError("Нужен refresh-токен или действующая сессия");
      }
      await this.tokenService.verifyRefreshTokenSignature(refreshToken);
    }

    await this.logoutUseCase.execute(
      userId,
      accessToken,
      refreshToken
    );
  
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
    });
  
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message:
        "Logged out successfully",
    });
  });

  /**
   * Get all user sessions
   * GET /api/auth/sessions
   */
  getSessions = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    // jti текущей сессии пришёл из проверенного access-токена в middleware
    // (AR-16): у GET-запроса тела нет, брать токен было неоткуда.
    const sessions = await this.getUserSessionsUseCase.execute(
      userId,
      req.user.jti ?? null
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: sessions,
    });
  });

  /**
   * Revoke a specific session
   * DELETE /api/auth/sessions/:sessionId
   */
  revokeSession = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const sessionId = req.params.sessionId;

    const result = await this.revokeSessionUseCase.execute(sessionId, userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
    });
  });

  /**
   * Revoke all sessions except current
   * POST /api/auth/sessions/revoke-all
   */
  revokeAllOtherSessions = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    const result = await this.revokeAllSessionsUseCase.execute(
      userId,
      req.user.jti ?? null
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
    });
  });

  /**
   * Logout from all devices
   * POST /api/auth/logout-all
   */
  logoutAll = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    // Revoke all sessions (including current)
    await this.revokeAllSessionsUseCase.execute(userId, null);

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  });
}
