import { AuthorizationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";
import { publishToChats } from "./adPublishing.js";

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

  async execute(adData, authenticatedUserId, selectedChats = []) {
    // Verify user exists and is active
    const user = await this.userRepository.findById(adData.user_id);

    if (!user) {
      throw new AuthorizationError("User not found");
    }

    if (!user.isActive()) {
      throw new AuthorizationError("User account is not active");
    }

    // Verify authenticated user matches ad creator
    if (String(adData.user_id) !== String(authenticatedUserId)) {
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
    logger.info("Telegram publication check", {
      selectedChats,
      hasSelectedChats: selectedChats && selectedChats.length > 0,
      ad_id: ad.id,
    });

    if (selectedChats && selectedChats.length > 0) {
      await this.#publishToSelectedChats(ad, selectedChats);
    }

    return ad;
  }

  /**
   * Публикуем только в те чаты, которые выбрал автор: он уже видит доступный
   * список, поэтому дополнительная фильтрация по `visible_to_all` не нужна.
   * Сбой Telegram не отменяет созданное объявление.
   */
  async #publishToSelectedChats(ad, selectedChats) {
    try {
      const allAdsChats = await this.telegramChatRepository.getActiveChats(
        "ads",
        false
      );
      const chosen = new Set(selectedChats.map(String));
      const chats = allAdsChats
        .filter((chat) => chosen.has(String(chat.id)))
        .map(({ chat_id: chatId, thread_id: threadId }) => ({
          chat_id: chatId,
          thread_id: threadId,
        }));

      if (!chats.length) {
        logger.warn("No matching Telegram chats for publication", {
          ad_id: ad.id,
          selected_chats: selectedChats,
          available_chats: allAdsChats.map((chat) => ({
            id: chat.id,
            chat_id: chat.chat_id,
            name: chat.name,
          })),
        });
        return;
      }

      await publishToChats({ ad, chats, telegramService: this.telegramService });
    } catch (err) {
      logger.error("Error publishing ad to Telegram", {
        ad_id: ad.id,
        error: err.message,
      });
      // Не пробрасываем: объявление создано, и сбой бота не должен выглядеть
      // как несозданное.
    }
  }
}
