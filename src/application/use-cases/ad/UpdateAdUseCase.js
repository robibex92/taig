import {
  NotFoundError,
  AuthorizationError,
} from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for updating an ad
 */
export class UpdateAdUseCase {
  constructor(adRepository) {
    this.adRepository = adRepository;
  }

  async execute(adId, updateData, authenticatedUserId) {
    // Find the ad
    const ad = await this.adRepository.findById(adId);

    if (!ad) {
      throw new NotFoundError("Ad");
    }

    // Verify ownership
    if (!ad.belongsToUser(authenticatedUserId)) {
      throw new AuthorizationError("You can only update your own ads");
    }

    // Update the ad
    const updatedAd = await this.adRepository.update(adId, updateData);

    logger.info("Ad updated successfully", {
      ad_id: adId,
      user_id: authenticatedUserId,
    });

    return updatedAd;
  }
}
