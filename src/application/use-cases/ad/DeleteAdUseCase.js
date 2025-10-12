import {
  NotFoundError,
  AuthorizationError,
} from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for deleting an ad
 */
export class DeleteAdUseCase {
  constructor(adRepository) {
    this.adRepository = adRepository;
  }

  async execute(adId, authenticatedUserId, soft = true) {
    // Find the ad
    const ad = await this.adRepository.findById(adId);

    if (!ad) {
      throw new NotFoundError("Ad");
    }

    // Verify ownership
    if (!ad.belongsToUser(authenticatedUserId)) {
      throw new AuthorizationError("You can only delete your own ads");
    }

    // Delete the ad
    await this.adRepository.delete(adId, soft);

    logger.info("Ad deleted successfully", {
      ad_id: adId,
      user_id: authenticatedUserId,
      soft,
    });

    return { success: true, message: "Ad deleted successfully" };
  }
}
