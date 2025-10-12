import {
  NotFoundError,
  AuthorizationError,
} from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for updating user profile
 */
export class UpdateUserUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId, updateData, authenticatedUserId) {
    // Verify user can only update their own profile
    if (userId !== authenticatedUserId) {
      throw new AuthorizationError("You can only update your own profile");
    }

    // Find user
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError("User");
    }

    // Update user
    const updatedUser = await this.userRepository.update(userId, {
      ...updateData,
      is_manually_updated: true, // Mark as manually updated
    });

    logger.info("User profile updated", { user_id: userId });

    return updatedUser;
  }
}
