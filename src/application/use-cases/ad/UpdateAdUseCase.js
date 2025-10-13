import {
  NotFoundError,
  AuthorizationError,
} from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for updating an ad
 */
export class UpdateAdUseCase {
  constructor(adRepository, telegramService) {
    this.adRepository = adRepository;
    this.telegramService = telegramService;
  }

  async execute(
    adId,
    updateData,
    authenticatedUserId,
    telegramUpdateType = null
  ) {
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

    // Update in Telegram if requested
    if (telegramUpdateType && ad.telegram_message_id && ad.telegram_chat_id) {
      try {
        await this.telegramService.updateAdStatus(
          updatedAd,
          ad.telegram_chat_id,
          ad.telegram_message_id,
          ad.telegram_thread_id
        );
        logger.info("Ad status updated in Telegram", {
          ad_id: adId,
          telegram_chat_id: ad.telegram_chat_id,
          telegram_message_id: ad.telegram_message_id,
        });
      } catch (err) {
        logger.error("Failed to update ad status in Telegram", {
          ad_id: adId,
          error: err.message,
        });
        // Don't throw - ad update should succeed even if Telegram fails
      }
    }

    return updatedAd;
  }
}
