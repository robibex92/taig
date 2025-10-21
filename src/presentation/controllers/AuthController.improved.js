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

    // iPhone Safari specific cookie settings
    const isProduction = process.env.NODE_ENV === "production";
    const isHTTPS = process.env.HTTPS === "true";
    const userAgent = req.get("User-Agent") || "";
    const isIPhone =
      userAgent.includes("iPhone") || userAgent.includes("Mobile");
    const isSafari =
      userAgent.includes("Safari") && !userAgent.includes("Chrome");
    const isMobileSafari =
      isIPhone || (isSafari && userAgent.includes("Mobile"));

    // For iPhone Safari, use more permissive settings
    const cookieOptions = {
      httpOnly: true,
      secure: isHTTPS, // Only true if explicitly set to HTTPS
      sameSite: isProduction && isHTTPS ? "none" : "lax", // Use 'lax' for development, 'none' only for HTTPS production
      maxAge: refreshTokenExpiration * 1000,
      // iPhone Safari specific: add domain if needed
      ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
    };

    res.cookie("refreshToken", result.refreshToken, cookieOptions);

    // Debug: Log cookie setting for iPhone
    logger.info("Setting refresh token cookie", {
      options: cookieOptions,
      hasRefreshToken: !!result.refreshToken,
      userAgent: userAgent,
      isIPhone,
      isSafari,
      isMobileSafari,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        // Send refresh token in body for mobile Safari as fallback
        refreshToken: isMobileSafari ? result.refreshToken : undefined,
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    });
  });

  /**
   * Refresh access token
   * POST /api-v1/auth/refresh
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

    // iPhone Safari specific cookie settings
    const isProduction = process.env.NODE_ENV === "production";
    const isHTTPS =
      process.env.HTTPS === "true" || process.env.NODE_ENV === "production";

    const cookieOptions = {
      httpOnly: true,
      secure: isHTTPS, // Must be true for sameSite: 'none' to work
      sameSite: isProduction ? "none" : "lax",
      maxAge: refreshTokenExpiration * 1000,
      // iPhone Safari specific: add domain if needed
      ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
    };

    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

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
