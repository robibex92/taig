import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for uploading user avatar
 */
export class UploadAvatarUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId, avatarPath) {
    logger.info("Uploading avatar", { userId, avatarPath });

    // Find user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Update avatar path (relative path for serving)
    const relativeAvatarPath = `/uploads/${avatarPath.split("/").pop()}`;

    // Update user avatar
    const updatedUser = await this.userRepository.update(userId, {
      avatar: relativeAvatarPath,
    });

    logger.info("Avatar uploaded successfully", {
      userId,
      avatar: relativeAvatarPath,
    });

    return updatedUser;
  }
}
