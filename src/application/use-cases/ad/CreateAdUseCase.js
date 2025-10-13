import { AuthorizationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for creating a new ad
 */
export class CreateAdUseCase {
  constructor(
    adRepository,
    userRepository,
    telegramChatRepository,
    telegramService
  ) {
    this.adRepository = adRepository;
    this.userRepository = userRepository;
    this.telegramChatRepository = telegramChatRepository;
    this.telegramService = telegramService;
  }

  async execute(adData, authenticatedUserId, selectedChatIds = []) {
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

    // Publish to Telegram chats if selected
    if (selectedChatIds && selectedChatIds.length > 0) {
      try {
        // Get all active ads chats from DB
        // Note: We don't filter by visible_to_all here because user already selected specific chats
        const allAdsChats = await this.telegramChatRepository.getActiveChats(
          "ads",
          false // visibleToAllOnly = false, because we trust the user's selection
        );

        // Filter to only selected chats
        const selectedChats = allAdsChats.filter(
          (chat) =>
            selectedChatIds.includes(String(chat.id)) ||
            selectedChatIds.includes(chat.id)
        );

        // Publish to each selected chat
        for (const chat of selectedChats) {
          try {
            await this.telegramService.publishAd(
              ad,
              chat.chat_id,
              chat.thread_id
            );
            logger.info(`Ad published to Telegram chat: ${chat.name}`, {
              ad_id: ad.id,
              chat_id: chat.chat_id,
              thread_id: chat.thread_id,
            });
          } catch (err) {
            logger.error(
              `Failed to publish ad to Telegram chat: ${chat.name}`,
              {
                ad_id: ad.id,
                chat_id: chat.chat_id,
                error: err.message,
              }
            );
          }
        }
      } catch (err) {
        logger.error("Error publishing ad to Telegram", {
          ad_id: ad.id,
          error: err.message,
        });
        // Don't throw - ad creation should succeed even if Telegram fails
      }
    }

    return ad;
  }
}
