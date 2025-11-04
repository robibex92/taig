import {
  NotFoundError,
  AuthorizationError,
} from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for deleting an ad
 */
export class DeleteAdUseCase {
  constructor(adRepository, telegramService) {
    this.adRepository = adRepository;
    this.telegramService = telegramService;
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

    // Delete the ad from the database
    await this.adRepository.delete(adId, soft);

    logger.info("Ad soft-deleted successfully from database", {
      ad_id: adId,
      user_id: authenticatedUserId,
    });

    // Now, delete associated Telegram messages
    try {
      const telegramMessages = await this.adRepository.getTelegramMessagesByAdId(
        adId
      );

      if (telegramMessages && telegramMessages.length > 0) {
        logger.info(
          `Found ${telegramMessages.length} Telegram messages to delete for ad ${adId}.`
        );
        for (const msg of telegramMessages) {
          try {
            await this.telegramService.deleteMessage({
              chatId: msg.chat_id,
              messageId: msg.message_id,
            });
          } catch (telegramError) {
            logger.error(
              `Failed to delete Telegram message ${msg.message_id} from chat ${msg.chat_id} for ad ${adId}.`,
              {
                error: telegramError.message,
              }
            );
            // Continue to the next message, don't stop the whole process
          }
        }
        logger.info(
          `Finished attempting to delete ${telegramMessages.length} Telegram messages for ad ${adId}.`
        );
      }
    } catch (error) {
      logger.error(
        `Failed to fetch or delete Telegram messages for ad ${adId}.`,
        {
          error: error.message,
        }
      );
      // Do not re-throw, as the main ad deletion was successful
    }

    return { success: true, message: "Ad deleted successfully" };
  }
}
