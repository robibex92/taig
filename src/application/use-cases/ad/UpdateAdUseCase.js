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

    // Check if status is changing to 'archive' or 'deleted'
    const oldStatus = ad.status;
    const newStatus = updateData.status;
    const statusChanged = newStatus && newStatus !== oldStatus;

    // Update the ad
    const updatedAd = await this.adRepository.update(adId, updateData);

    logger.info("Ad updated successfully", {
      ad_id: adId,
      user_id: authenticatedUserId,
      status_changed: statusChanged,
      old_status: oldStatus,
      new_status: newStatus,
    });

    // Update Telegram messages when status changes to archive/deleted
    if (statusChanged && (newStatus === "archive" || newStatus === "deleted")) {
      try {
        // Get all Telegram messages for this ad
        const telegramMessages =
          await this.adRepository.getTelegramMessagesByAdId(adId);

        if (telegramMessages && telegramMessages.length > 0) {
          logger.info(
            `Found ${telegramMessages.length} Telegram messages to update for ad ${adId}`
          );

          // Prepare status text
          const statusEmoji = newStatus === "archive" ? "🗃" : "🚫";
          const statusText =
            newStatus === "archive"
              ? "АРХИВ - Объявление снято с продажи"
              : "УДАЛЕНО - Объявление больше не доступно";

          // Update caption for each message
          const updatePromises = telegramMessages.map(async (msg) => {
            try {
              const originalCaption =
                msg.caption ||
                `${updatedAd.title}\n\n${updatedAd.content}\n\nЦена: ${updatedAd.price}`;
              const updatedCaption = `${statusEmoji} <b>${statusText}</b>\n\n<s>${originalCaption}</s>`;

              return await this.telegramService.editMessageCaption({
                chatId: msg.chat_id,
                messageId: msg.message_id,
                caption: updatedCaption,
                threadId: msg.thread_id || undefined,
                parse_mode: "HTML",
              });
            } catch (err) {
              logger.error(
                `Failed to update Telegram message ${msg.message_id}`,
                {
                  error: err.message,
                  chat_id: msg.chat_id,
                  message_id: msg.message_id,
                }
              );
              return { success: false, error: err.message };
            }
          });

          const results = await Promise.allSettled(updatePromises);
          const successCount = results.filter(
            (r) => r.status === "fulfilled" && r.value?.success
          ).length;

          logger.info(
            `Updated ${successCount}/${telegramMessages.length} Telegram messages for archived/deleted ad`,
            {
              ad_id: adId,
              new_status: newStatus,
            }
          );
        }
      } catch (err) {
        logger.error("Failed to update Telegram messages for status change", {
          ad_id: adId,
          error: err.message,
          stack: err.stack,
        });
        // Don't throw - ad update should succeed even if Telegram fails
      }
    }

    // Update in Telegram if requested (for other updates like price, title, etc.)
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
