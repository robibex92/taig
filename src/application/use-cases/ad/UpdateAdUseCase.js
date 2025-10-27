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
            `Found ${telegramMessages.length} Telegram messages to handle for ad ${adId}`
          );

          if (newStatus === "archive") {
            // For archived ads, delete messages from Telegram
            logger.info(
              `Deleting ${telegramMessages.length} Telegram messages for archived ad ${adId}`
            );

            const deletePromises = telegramMessages.map(async (msg) => {
              try {
                return await this.telegramService.deleteMessage({
                  chatId: msg.chat_id,
                  messageId: msg.message_id,
                  threadId: msg.thread_id || undefined,
                });
              } catch (err) {
                logger.error(
                  `Failed to delete Telegram message ${msg.message_id}`,
                  {
                    error: err.message,
                    chat_id: msg.chat_id,
                    message_id: msg.message_id,
                  }
                );
                return { success: false, error: err.message };
              }
            });

            const results = await Promise.allSettled(deletePromises);
            const successCount = results.filter(
              (r) => r.status === "fulfilled" && r.value?.success
            ).length;

            logger.info(
              `Deleted ${successCount}/${telegramMessages.length} Telegram messages for archived ad`,
              {
                ad_id: adId,
                success_count: successCount,
                total_count: telegramMessages.length,
              }
            );

            // Remove telegram message records from database
            await this.adRepository.deleteTelegramMessagesByAdId(adId);
          } else if (newStatus === "deleted") {
            // For deleted ads, delete messages from Telegram (same as archive)
            logger.info(
              `Deleting ${telegramMessages.length} Telegram messages for deleted ad ${adId}`
            );

            const deletePromises = telegramMessages.map(async (msg) => {
              try {
                return await this.telegramService.deleteMessage({
                  chatId: msg.chat_id,
                  messageId: msg.message_id,
                  threadId: msg.thread_id || undefined,
                });
              } catch (err) {
                logger.error(
                  `Failed to delete Telegram message ${msg.message_id}`,
                  {
                    error: err.message,
                    chat_id: msg.chat_id,
                    message_id: msg.message_id,
                  }
                );
                return { success: false, error: err.message };
              }
            });

            const results = await Promise.allSettled(deletePromises);
            const successCount = results.filter(
              (r) => r.status === "fulfilled" && r.value?.success
            ).length;

            logger.info(
              `Deleted ${successCount}/${telegramMessages.length} Telegram messages for deleted ad`,
              {
                ad_id: adId,
                success_count: successCount,
                total_count: telegramMessages.length,
              }
            );

            // Remove telegram message records from database
            await this.adRepository.deleteTelegramMessagesByAdId(adId);
          }
        }
      } catch (err) {
        logger.error("Failed to handle Telegram messages for status change", {
          ad_id: adId,
          error: err.message,
          stack: err.stack,
        });
        // Don't throw - ad update should succeed even if Telegram fails
      }
    }

    // Handle Telegram updates for active ads
    if (telegramUpdateType) {
      try {
        const telegramMessages =
          await this.adRepository.getTelegramMessagesByAdId(adId);

        if (!telegramMessages || telegramMessages.length === 0) {
          logger.info("No Telegram messages found for ad", { ad_id: adId });
          return updatedAd;
        }

        if (telegramUpdateType === "repost") {
          // Delete old messages and repost with new images
          logger.info(
            `Reposting ad ${adId} - deleting old messages and sending new ones`
          );

          // Delete old messages sequentially with delay for reliability
          for (const msg of telegramMessages) {
            try {
              await this.telegramService.deleteMessage({
                chatId: String(msg.chat_id),
                messageId: String(msg.message_id),
                threadId: msg.thread_id ? String(msg.thread_id) : undefined,
              });
              // Small delay between deletions to avoid rate limiting
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (err) {
              logger.error(
                `Failed to delete Telegram message ${msg.message_id}`,
                {
                  error: err.message,
                  chat_id: msg.chat_id,
                  message_id: msg.message_id,
                }
              );
            }
          }

          // Delete old records from database
          await this.adRepository.deleteTelegramMessagesByAdId(adId);

          // Load refreshed ad with all images from database
          const refreshedAd = await this.adRepository.findById(adId);
          if (!refreshedAd) {
            throw new Error("Failed to load refreshed ad");
          }

          if (!refreshedAd.images || refreshedAd.images.length === 0) {
            logger.warn("No images found for repost", { ad_id: adId });
          }

          // Group messages by chat_id and thread_id
          const chatGroups = new Map();
          telegramMessages.forEach((msg) => {
            const key = `${msg.chat_id}_${msg.thread_id || "no_thread"}`;
            if (!chatGroups.has(key)) {
              chatGroups.set(key, {
                chat_id: msg.chat_id,
                thread_id: msg.thread_id,
              });
            }
          });

          // Publish to each chat/thread sequentially with delay
          for (const chatInfo of chatGroups.values()) {
            try {
              await this.telegramService.publishAd(
                refreshedAd,
                chatInfo.chat_id,
                chatInfo.thread_id
              );
              logger.info(`Ad reposted in Telegram chat`, {
                ad_id: adId,
                chat_id: chatInfo.chat_id,
                thread_id: chatInfo.thread_id,
              });
              // Delay between publications to avoid rate limiting
              await new Promise((resolve) => setTimeout(resolve, 300));
            } catch (err) {
              logger.error(`Failed to repost ad in Telegram chat`, {
                ad_id: adId,
                chat_id: chatInfo.chat_id,
                error: err.message,
              });
            }
          }
        } else if (telegramUpdateType === "update_text") {
          // Update existing messages (only for text changes)
          logger.info(
            `Updating text for ${telegramMessages.length} Telegram messages`
          );

          // Check message age and fallback to repost if needed
          let useRepost = false;
          const now = new Date();
          const failedUpdates = [];

          for (const msg of telegramMessages) {
            try {
              const messageAge = now - new Date(msg.created_at);
              const hoursOld = messageAge / (1000 * 60 * 60);

              // Telegram doesn't allow editing messages older than 48 hours
              if (hoursOld > 48) {
                logger.info(
                  `Message ${msg.message_id} is ${hoursOld.toFixed(
                    1
                  )} hours old, will repost instead of edit`
                );
                useRepost = true;
                break;
              }

              const result = await this.telegramService.updateAdStatus(
                updatedAd,
                String(msg.chat_id),
                String(msg.message_id),
                msg.thread_id ? String(msg.thread_id) : null
              );

              if (!result || !result.success) {
                failedUpdates.push(msg);
              }

              // Small delay between updates
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (err) {
              logger.error(
                `Failed to update Telegram message ${msg.message_id}`,
                {
                  error: err.message,
                  chat_id: msg.chat_id,
                  message_id: msg.message_id,
                }
              );
              failedUpdates.push(msg);
            }
          }

          // If update failed or messages too old, fallback to repost
          if (useRepost || failedUpdates.length > 0) {
            logger.info(
              `Fallback to repost due to age or failed updates. Failed: ${failedUpdates.length}`
            );

            // Delete all old messages
            for (const msg of telegramMessages) {
              try {
                await this.telegramService.deleteMessage({
                  chatId: String(msg.chat_id),
                  messageId: String(msg.message_id),
                  threadId: msg.thread_id ? String(msg.thread_id) : undefined,
                });
                await new Promise((resolve) => setTimeout(resolve, 100));
              } catch (err) {
                logger.error(
                  `Failed to delete message during fallback repost`,
                  { error: err.message }
                );
              }
            }

            // Delete old records
            await this.adRepository.deleteTelegramMessagesByAdId(adId);

            // Load refreshed ad
            const refreshedAd = await this.adRepository.findById(adId);
            if (!refreshedAd) {
              throw new Error("Failed to load refreshed ad");
            }

            // Group messages by chat
            const chatGroups = new Map();
            telegramMessages.forEach((msg) => {
              const key = `${msg.chat_id}_${msg.thread_id || "no_thread"}`;
              if (!chatGroups.has(key)) {
                chatGroups.set(key, {
                  chat_id: msg.chat_id,
                  thread_id: msg.thread_id,
                });
              }
            });

            // Repost to each chat
            for (const chatInfo of chatGroups.values()) {
              try {
                await this.telegramService.publishAd(
                  refreshedAd,
                  chatInfo.chat_id,
                  chatInfo.thread_id
                );
                await new Promise((resolve) => setTimeout(resolve, 300));
              } catch (err) {
                logger.error(`Failed to repost ad`, {
                  error: err.message,
                });
              }
            }
          } else {
            logger.info(
              `Updated ${telegramMessages.length - failedUpdates.length}/${
                telegramMessages.length
              } Telegram messages successfully`
            );
          }
        }
      } catch (err) {
        logger.error("Failed to handle Telegram updates", {
          ad_id: adId,
          error: err.message,
          stack: err.stack,
        });
        // Don't throw - ad update should succeed even if Telegram fails
      }
    }

    return updatedAd;
  }
}
