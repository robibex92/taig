import { AuthorizationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for creating a new ad
 */
export class CreateAdUseCase {
  constructor(adRepository, userRepository) {
    this.adRepository = adRepository;
    this.userRepository = userRepository;
  }

  async execute(adData, authenticatedUserId) {
    // Verify user exists and is active
    const user = await this.userRepository.findById(adData.user_id);

    if (!user) {
      throw new AuthorizationError("User not found");
    }

    if (!user.isActive()) {
      throw new AuthorizationError("User account is not active");
    }

    // Verify authenticated user matches ad creator
    if (adData.user_id !== authenticatedUserId) {
      throw new AuthorizationError("Cannot create ad for another user");
    }

    // Create the ad
    const ad = await this.adRepository.create(adData);

    logger.info("Ad created successfully", {
      ad_id: ad.id,
      user_id: ad.user_id,
      title: ad.title,
    });

    return ad;
  }
}
