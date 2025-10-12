const { ValidationError } = require("../../../core/errors/AppError");

/**
 * Unlink Platform Use Case
 * Unlinks Telegram or MAX from user account
 */
class UnlinkPlatformUseCase {
  constructor({ userRepository, refreshTokenRepository }) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  async execute({ userId, platform }) {
    // 1. Validate platform
    if (!["telegram", "max"].includes(platform)) {
      throw new ValidationError(
        "Invalid platform. Must be 'telegram' or 'max'"
      );
    }

    // 2. Get user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ValidationError("User not found");
    }

    // 3. Check if user has at least one platform
    if (platform === "telegram" && !user.max_id) {
      throw new ValidationError(
        "Cannot unlink Telegram - no MAX account linked. User must have at least one platform."
      );
    }

    if (platform === "max" && !user.id_telegram) {
      throw new ValidationError(
        "Cannot unlink MAX - no Telegram account linked. User must have at least one platform."
      );
    }

    // 4. Determine new primary platform
    const newPrimaryPlatform = platform === "telegram" ? "max" : "telegram";

    // 5. Unlink platform
    const updateData = {
      platforms_linked: false,
      primary_platform: newPrimaryPlatform,
    };

    if (platform === "telegram") {
      updateData.id_telegram = null;
      updateData.telegram_username = null;
      updateData.telegram_photo_url = null;
    } else {
      updateData.max_id = null;
      updateData.max_first_name = null;
      updateData.max_last_name = null;
      updateData.max_photo_url = null;
      updateData.max_platform = null;
    }

    const updatedUser = await this.userRepository.update(userId, updateData);

    // 6. Revoke all refresh tokens for this platform
    await this.refreshTokenRepository.revokeAllByUserAndPlatform(
      userId,
      platform
    );

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
      message: `${
        platform === "telegram" ? "Telegram" : "MAX"
      } account unlinked successfully`,
    };
  }
}

module.exports = UnlinkPlatformUseCase;
