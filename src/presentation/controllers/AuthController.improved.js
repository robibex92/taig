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
   * POST /api/v1/auth/telegram
   */
  authenticateTelegram = asyncHandler(async (req, res) => {
    const telegramData = req.body;
    const rememberMe = req.body.remember_me || false;

    // Extract device information
    const deviceInfo = this.tokenService.extractDeviceInfo(req);

    // Authenticate user
    const result = await this.authenticateUserUseCase.execute(
      telegramData,
      deviceInfo,
      rememberMe
    );

    // Security: Set refresh token in httpOnly cookie (more secure than localStorage)
    // This prevents XSS attacks from stealing the refresh token
    const refreshTokenExpiration =
      this.tokenService.getRefreshTokenExpiration(rememberMe);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict", // CSRF protection
      maxAge: refreshTokenExpiration * 1000,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        // Don't send refresh token in body when using cookies
        // refreshToken: result.refreshToken,
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    });
  });

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  refreshToken = asyncHandler(async (req, res) => {
    // Try to get refresh token from cookie (preferred)
    let refreshToken = req.cookies?.refreshToken;

    // Fallback to Authorization header (for mobile apps)
    if (!refreshToken) {
      const authHeader = req.headers.authorization;
      refreshToken = authHeader?.split(" ")[1];
    }

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

    // Update refresh token in cookie
    const refreshTokenExpiration =
      this.tokenService.getRefreshTokenExpiration();

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiration * 1000,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        // refreshToken: tokens.refreshToken, // Don't send in body
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    });
  });

  /**
   * Get current session user
   * GET /api/v1/auth/session
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
   * POST /api/v1/auth/logout
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
      sameSite: "strict",
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Logged out successfully",
    });
  });

  /**
   * Get all user sessions
   * GET /api/v1/auth/sessions
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
   * DELETE /api/v1/auth/sessions/:sessionId
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
   * POST /api/v1/auth/sessions/revoke-all
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
   * POST /api/v1/auth/logout-all
   */
  logoutAll = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;

    // Revoke all sessions (including current)
    await this.revokeAllSessionsUseCase.execute(userId, null);

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  });
}
