import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for refreshing access token
 */
export class RefreshTokenUseCase {
  constructor(userRepository, tokenService) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
  }

  async execute(refreshToken) {
    console.log("=== REFRESH TOKEN DEBUG ===");
    console.log(
      "Received refresh token:",
      refreshToken ? `${refreshToken.substring(0, 20)}...` : "missing"
    );

    // Verify refresh token
    const decoded = this.tokenService.verifyToken(refreshToken);
    console.log("Decoded token:", decoded);

    if (!decoded) {
      console.log("Token verification failed");
      throw new AuthenticationError("Invalid refresh token");
    }

    // Find user
    const user = await this.userRepository.findById(decoded.id);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    // Verify stored refresh token matches
    const storedToken = await this.userRepository.getRefreshToken(user.user_id);

    if (storedToken !== refreshToken) {
      throw new AuthenticationError("Refresh token mismatch");
    }

    // Check if user is banned
    if (user.isBanned()) {
      throw new AuthenticationError("User account is banned");
    }

    // Generate new tokens
    const tokens = this.tokenService.generateTokens(user);

    // Save new refresh token
    await this.userRepository.saveRefreshToken(
      user.user_id,
      tokens.refreshToken
    );

    logger.info("Access token refreshed", { user_id: user.user_id });

    return tokens;
  }
}
