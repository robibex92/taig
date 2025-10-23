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
    
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.error("TELEGRAM_BOT_TOKEN not configured");
      return false;
    }
    
    if (!hash) {
      logger.error("No hash provided in Telegram auth data");
      return false;
    }
    
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

    const isValid = hmac === hash;
    
    if (!isValid) {
      logger.warn("Telegram hash validation failed", {
        expected: hmac,
        received: hash,
        checkString: checkString.substring(0, 100) + "..."
      });
    }
    
    return isValid;
  }

  async execute(telegramAuthData) {
    // Log received data for debugging
    logger.info("Telegram auth data received", {
      id: telegramAuthData.id,
      username: telegramAuthData.username,
      first_name: telegramAuthData.first_name,
      auth_date: telegramAuthData.auth_date,
      hash: telegramAuthData.hash ? "present" : "missing",
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN
    });

    // Verify Telegram authentication
    if (!this.verifyTelegramAuth(telegramAuthData)) {
      logger.warn("Invalid Telegram authentication attempt", {
        telegram_id: telegramAuthData.id,
        ip: telegramAuthData.ip || "unknown"
      });
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
