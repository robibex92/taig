import crypto from "crypto";
import {
  ValidationError,
  ConflictError,
  AuthenticationError,
} from "../../../core/errors/AppError.js";

/**
 * Link Telegram Account Use Case
 * Links Telegram account to existing MAX user
 */
class LinkTelegramAccountUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({
    userId,
    id_telegram,
    first_name,
    last_name,
    username,
    photo_url,
    auth_date,
    hash,
  }) {
    // 1. Verify Telegram auth data
    if (
      !this._verifyTelegramAuth({
        id: id_telegram,
        first_name,
        last_name,
        username,
        photo_url,
        auth_date,
        hash,
      })
    ) {
      throw new AuthenticationError("Invalid Telegram signature");
    }

    // 2. Get current user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ValidationError("User not found");
    }

    // 3. Check if user already has Telegram linked
    if (user.id_telegram) {
      throw new ConflictError("Telegram account already linked to this user");
    }

    // 4. Check if this Telegram account is already linked to another user
    const existingTelegramUser = await this.userRepository.findByTelegramId(
      id_telegram
    );
    if (existingTelegramUser && existingTelegramUser.id !== userId) {
      throw new ConflictError(
        "This Telegram account is already linked to another user"
      );
    }

    // 5. Link Telegram account
    const updatedUser = await this.userRepository.update(userId, {
      id_telegram,
      telegram_username: username,
      telegram_photo_url: photo_url,
      platforms_linked: true,
    });

    return {
      user: {
        id: updatedUser.id,
        id_telegram: updatedUser.id_telegram,
        max_id: updatedUser.max_id,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        photo_url: updatedUser.photo_url,
        primary_platform: updatedUser.primary_platform,
        platforms_linked: updatedUser.platforms_linked,
      },
    };
  }

  /**
   * Verify Telegram Web App data
   */
  _verifyTelegramAuth(data) {
    const { hash, ...dataToCheck } = data;

    const dataCheckString = Object.keys(dataToCheck)
      .sort()
      .map((key) => `${key}=${dataToCheck[key]}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return calculatedHash === hash;
  }
}

export default LinkTelegramAccountUseCase;
