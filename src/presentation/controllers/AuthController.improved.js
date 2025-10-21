import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

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
    tokenService
  ) {
    this.authenticateUserUseCase = authenticateUserUseCase;
    this.refreshTokenUseCase = refreshTokenUseCase;
    this.logoutUseCase = logoutUseCase;
    this.getUserSessionsUseCase = getUserSessionsUseCase;
    this.revokeSessionUseCase = revokeSessionUseCase;
    this.revokeAllSessionsUseCase = revokeAllSessionsUseCase;
    this.userRepository = userRepository;
    this.tokenService = tokenService;
  }

  /**
   * Authenticate user via Telegram
   * POST /api-v1/auth/telegram
   */
  authenticateTelegram = asyncHandler(async (req, res) => {
    const telegramData = req.body;
    const rememberMe = req.body.remember_me || false;

    // Extract device information
    const deviceInfo = this.tokenService.extractDeviceInfo(req);

    const result = await this.authenticateUserUseCase.execute(
      telegramData,
      deviceInfo,
      rememberMe
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

    // Get tokens
    const accessToken = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies?.refreshToken;

    // Logout
    await this.logoutUseCase.execute(userId, accessToken, refreshToken);

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Logged out successfully",
    });
  });

  /**
   * Get all user sessions
   * GET /api-v1/auth/sessions
   */
  getSessions = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const currentRefreshToken = req.cookies?.refreshToken;

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
    const currentRefreshToken = req.cookies?.refreshToken;

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
