const { ValidationError } = require("../../../core/errors/AppError");

/**
 * Get Platforms Info Use Case
 * Returns user's linked platforms information
 */
class GetPlatformsInfoUseCase {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ userId }) {
    // 1. Get user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ValidationError("User not found");
    }

    // 2. Build platforms info
    return {
      telegram: {
        linked: !!user.id_telegram,
        id: user.id_telegram || null,
        username: user.telegram_username || null,
        photo_url: user.telegram_photo_url || null,
      },
      max: {
        linked: !!user.max_id,
        id: user.max_id || null,
        first_name: user.max_first_name || null,
        last_name: user.max_last_name || null,
        photo_url: user.max_photo_url || null,
        platform: user.max_platform || null,
      },
      primary_platform: user.primary_platform,
      platforms_linked: user.platforms_linked,
    };
  }
}

module.exports = GetPlatformsInfoUseCase;
