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
    logger.info("🔐 Starting Telegram authentication", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      body: req.body,
    });

    const telegramData = req.body;
    const rememberMe = req.body.remember_me || false;

    logger.info("🔐 Telegram data received", {
      hasId: !!telegramData.id,
      hasUsername: !!telegramData.username,
      hasFirstName: !!telegramData.first_name,
      rememberMe,
    });

    // Extract device information
    const deviceInfo = this.tokenService.extractDeviceInfo(req);

    logger.info("🔐 Device info extracted", {
      deviceInfo,
    });

    // Authenticate user
    logger.info("🔐 Calling authenticateUserUseCase", {
      telegramDataId: telegramData.id,
      deviceInfo,
      rememberMe,
    });

    const result = await this.authenticateUserUseCase.execute(
      telegramData,
      deviceInfo,
      rememberMe
    );

    logger.info("🔐 User authentication successful", {
      user_id: result.user.id,
      username: result.user.username,
      ip: req.ip,
      hasAccessToken: !!result.accessToken,
      hasRefreshToken: !!result.refreshToken,
      accessTokenLength: result.accessToken ? result.accessToken.length : 0,
      refreshTokenLength: result.refreshToken ? result.refreshToken.length : 0,
    });

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

    logger.info("🔐 Browser detection", {
      isProduction,
      isHTTPS,
      isIPhone,
      isSafari,
      isMobileSafari,
      userAgent,
    });

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

    const responseData = {
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        // Send refresh token in body for Safari as fallback (when cookies don't work)
        refreshToken: isSafari ? result.refreshToken : undefined,
        expiresIn: this.tokenService.getAccessTokenExpiration(),
      },
    };

    logger.info("🔐 Sending response", {
      hasUser: !!responseData.data.user,
      hasAccessToken: !!responseData.data.accessToken,
      hasRefreshToken: !!responseData.data.refreshToken,
      refreshTokenInBody: isSafari,
      userAgent: userAgent,
    });

    res.status(HTTP_STATUS.OK).json(responseData);
  });

  /**
   * Refresh access token
   * POST /api-v1/auth/refresh
   */
  refreshToken = asyncHandler(async (req, res) => {
    logger.info("🔄 Starting token refresh", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      cookies: req.cookies,
      headers: req.headers,
      body: req.body,
    });

    // Try to get refresh token from cookie (preferred)
    let refreshToken = req.cookies?.refreshToken;

    // Fallback to Authorization header (for mobile apps)
    if (!refreshToken) {
      const authHeader = req.headers.authorization;
      refreshToken = authHeader?.split(" ")[1];
    }

    // Fallback to request body (for Safari when cookies don't work)
    if (!refreshToken && req.body?.refreshToken) {
      refreshToken = req.body.refreshToken;
      logger.info("Using refresh token from request body", {
        hasRefreshToken: !!refreshToken,
      });
    }

    logger.info("Refresh token source", {
      fromCookie: !!req.cookies?.refreshToken,
      fromHeader: !!req.headers.authorization,
      fromBody: !!req.body?.refreshToken,
      hasRefreshToken: !!refreshToken,
    });

    if (!refreshToken) {
      throw new ValidationError("Refresh token is required");
    }

    // Extract device information
    const deviceInfo = this.tokenService.extractDeviceInfo(req);

    // Refresh tokens
    logger.info("🔄 Calling refreshTokenUseCase", {
      refreshTokenLength: refreshToken ? refreshToken.length : 0,
      refreshTokenValue: refreshToken
        ? refreshToken.substring(0, 20) + "..."
        : "null",
      deviceInfo,
    });

    const tokens = await this.refreshTokenUseCase.execute(
      refreshToken,
      deviceInfo
    );

    logger.info("🔄 Token refresh successful", {
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      accessTokenLength: tokens.accessToken ? tokens.accessToken.length : 0,
      refreshTokenLength: tokens.refreshToken ? tokens.refreshToken.length : 0,
    });

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

    logger.info("🔄 Sending refresh response", {
      hasAccessToken: !!tokens.accessToken,
      accessTokenLength: tokens.accessToken ? tokens.accessToken.length : 0,
      cookieOptions,
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
