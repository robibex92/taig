import {
  ValidationError,
  ConflictError,
  AuthenticationError,
} from "../../../core/errors/AppError.js";

/**
 * Link MAX Account Use Case
 * Links MAX account to existing Telegram user
 */
class LinkMaxAccountUseCase {
  constructor({ userRepository, maxService }) {
    this.userRepository = userRepository;
    this.maxService = maxService;
  }

  async execute({
    userId,
    max_id,
    max_first_name,
    max_last_name,
    max_photo_url,
    max_platform,
    hash,
    auth_key,
    auth_date,
  }) {
    // 1. Validate MAX signature
    if (
      !this.maxService.verifySignature(
        { max_id, auth_key, auth_date, hash },
        process.env.MAX_BOT_SECRET
      )
    ) {
      throw new AuthenticationError("Invalid MAX signature");
    }

    // 2. Get current user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ValidationError("User not found");
    }

    // 3. Check if user already has MAX linked
    if (user.max_id) {
      throw new ConflictError("MAX account already linked to this user");
    }

    // 4. Check if this MAX account is already linked to another user
    const existingMaxUser = await this.userRepository.findByMaxId(max_id);
    if (existingMaxUser && existingMaxUser.id !== userId) {
      throw new ConflictError(
        "This MAX account is already linked to another user"
      );
    }

    // 5. Link MAX account
    const updatedUser = await this.userRepository.update(userId, {
      max_id,
      max_first_name,
      max_last_name,
      max_photo_url,
      max_platform,
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
}

export default LinkMaxAccountUseCase;
