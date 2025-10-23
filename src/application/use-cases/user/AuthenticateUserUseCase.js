import crypto from "crypto";
import { AuthenticationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for authenticating a user via Telegram
 */
export class AuthenticateUserUseCase {
  constructor(userRepository, tokenService) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
  }

  /**
   * Verify Telegram authentication data
   */
  verifyTelegramAuth(authData) {
    const { hash, ...data } = authData;
    const secret = crypto
      .createHash("sha256")
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();

    const checkString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join("\n");

    const hmac = crypto
      .createHmac("sha256", secret)
      .update(checkString)
      .digest("hex");

    // Simple debug logging
    console.log("=== VERIFICATION DEBUG ===");
    console.log("Received hash:", hash);
    console.log("Calculated hash:", hmac);
    console.log("Check string:", checkString);
    console.log("Data keys:", Object.keys(data).sort());
    console.log("Hashes match:", hmac === hash);

    return hmac === hash;
  }

  async execute(telegramAuthData) {
    // Simple debug logging
    console.log("=== TELEGRAM AUTH DEBUG ===");
    console.log("Received data:", JSON.stringify(telegramAuthData, null, 2));
    console.log("Bot token exists:", !!process.env.TELEGRAM_BOT_TOKEN);
    console.log(
      "Bot token length:",
      process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.length : 0
    );

    // Verify Telegram authentication
    const isValid = this.verifyTelegramAuth(telegramAuthData);
    console.log("Auth verification result:", isValid);

    if (!isValid) {
      console.log("=== AUTH FAILED ===");
      throw new AuthenticationError("Invalid Telegram authentication");
    }

    const { id, username, first_name, last_name, photo_url } = telegramAuthData;

    // Find or create user
    let user = await this.userRepository.findByTelegramId(id);

    if (!user) {
      // Create new user
      user = await this.userRepository.create({
        user_id: id,
        username: username || null,
        first_name,
        last_name: last_name || null,
        avatar: photo_url || null,
      });

      logger.info("New user registered", { user_id: user.user_id });
    } else {
      // Update user data if not manually updated
      if (!user.is_manually_updated) {
        await this.userRepository.update(id, {
          username: username || user.username,
          telegram_first_name: first_name,
          telegram_last_name: last_name || null,
          avatar: photo_url || user.avatar,
        });

        user = await this.userRepository.findByTelegramId(id);
      }

      logger.info("User logged in", { user_id: user.user_id });
    }

    // Check if user is banned
    if (user.isBanned()) {
      throw new AuthenticationError("User account is banned");
    }

    // Generate tokens
    const { accessToken, refreshToken } =
      this.tokenService.generateTokens(user);

    // Save refresh token
    await this.userRepository.saveRefreshToken(user.user_id, refreshToken);

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }
}
