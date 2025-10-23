import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";

/**
 * Auth Controller - handles authentication requests
 */
export class AuthController {
  constructor(authenticateUserUseCase, refreshTokenUseCase, userRepository) {
    this.authenticateUserUseCase = authenticateUserUseCase;
    this.refreshTokenUseCase = refreshTokenUseCase;
    this.userRepository = userRepository;
  }

  /**
   * Authenticate user via Telegram
   */
  authenticateTelegram = asyncHandler(async (req, res) => {
    const telegramData = req.body;

    const result = await this.authenticateUserUseCase.execute(telegramData);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  });

  /**
   * Refresh access token
   */
  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: "Refresh token is required",
          code: "VALIDATION_ERROR",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const tokens = await this.refreshTokenUseCase.execute(refreshToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  });

  /**
   * Get current session user
   */
  getSession = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const user = await this.userRepository.findById(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user.toJSON(),
    });
  });

  /**
   * Logout user
   */
  logout = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    await this.userRepository.clearRefreshToken(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Logged out successfully",
    });
  });
}
