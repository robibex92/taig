import { ValidationError } from "../../../core/errors/AppError.js";

/**
 * Update Platform Settings Use Case
 * Updates user's primary platform preference
 */
class UpdatePlatformSettingsUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ userId, primary_platform }) {
    // 1. Validate platform
    if (!["telegram", "max"].includes(primary_platform)) {
      throw new ValidationError(
        "Invalid platform. Must be 'telegram' or 'max'"
      );
    }

    // 2. Get user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ValidationError("User not found");
    }

    // 3. Check if user has both platforms linked
    if (!user.platforms_linked) {
      throw new ValidationError(
        "Cannot set primary platform - only one platform is linked"
      );
    }

    // 4. Check if user has the requested platform linked
    if (primary_platform === "telegram" && !user.id_telegram) {
      throw new ValidationError(
        "Cannot set Telegram as primary - no Telegram account linked"
      );
    }

    if (primary_platform === "max" && !user.max_id) {
      throw new ValidationError(
        "Cannot set MAX as primary - no MAX account linked"
      );
    }

    // 5. Update primary platform
    const updatedUser = await this.userRepository.update(userId, {
      primary_platform,
    });

    return {
      user: {
        id: updatedUser.id,
        primary_platform: updatedUser.primary_platform,
        platforms_linked: updatedUser.platforms_linked,
      },
      message: `Primary platform set to ${primary_platform}`,
    };
  }
}

export default UpdatePlatformSettingsUseCase;
