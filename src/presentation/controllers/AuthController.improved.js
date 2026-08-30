import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";

/**
 * Improved Auth Controller with enhanced security
 * - Device fingerprinting
 * - Session management
 * - CSRF protection (via SameSite cookies)
 * - Comprehensive audit logging
 */
export class AuthController {
  constructor(
    authenticateUserUseCase,
    refreshTokenUseCase,
    logoutUseCase,
    getUserSessionsUseCase,
    revokeSessionUseCase,
    revokeAllSessionsUseCase,
    userRepository,
    tokenService,
    authenticateMaxUserUseCase,
    linkPlatformUseCase
  ) {
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

    const result = await this.authenticateMaxUserUseCase.execute(
      initData,
      deviceInfo,
      rememberMe,
      req.body?.requestId || null
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
    const result = await this.linkPlatformUseCase.linkTelegram(
      req.user.user_id,
      req.body
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user.toJSON(),
        switchedToUserId: result.switchedToUserId,
      },
    });
  });

  /**
   * Authenticate user via Telegram
   * POST /api-v1/auth/telegram
   */
  authenticateTelegram = asyncHandler(async (req, res) => {
    const telegramData = req.body;

    // Extract device information
    const deviceInfo = this.tokenService.extractDeviceInfo(req);

    const result = await this.authenticateUserUseCase.execute(
      telegramData,
      deviceInfo
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
   * POST /api-v1/auth/refresh
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
   * GET /api-v1/auth/session
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
   * POST /api-v1/auth/logout
   */
  logout = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
  
    const accessToken =
      req.headers.authorization?.split(" ")[1] || null;
  
    const refreshToken =
      req.body?.refreshToken ||
      req.cookies?.refreshToken ||
      null;
  
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
   * GET /api-v1/auth/sessions
   */
  getSessions = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const currentRefreshTokenStack = [req.body?.refreshToken, req.cookies?.refreshToken];
    const currentRefreshToken =
      currentRefreshTokenStack.find((t) => typeof t === 'string' && t.length > 0) ?? null;

    const sessions = await this.getUserSessionsUseCase.execute(
      userId,
      currentRefreshToken
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: sessions,
    });
  });

  /**
   * Revoke a specific session
   * DELETE /api-v1/auth/sessions/:sessionId
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
   * POST /api-v1/auth/sessions/revoke-all
   */
  revokeAllOtherSessions = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const currentRefreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken ?? null;

    const result = await this.revokeAllSessionsUseCase.execute(
      userId,
      currentRefreshToken
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message,
    });
  });

  /**
   * Logout from all devices
   * POST /api-v1/auth/logout-all
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
