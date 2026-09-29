import {
  NotFoundError,
  AuthorizationError,
} from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";
import {
  chatGroupsFor,
  clearChatsForRepost,
  MESSAGE_OPERATION_DELAY_MS,
  publishToChats,
  removeAdFromChats,
  resolveChatTargets,
  sleep,
} from "./adPublishing.js";
import { publishToMaxChats, removeAdFromMaxChats } from "./maxAdPublishing.js";

/** Telegram не даёт править сообщение старше двух суток — такое только переопубликовывается. */
const MAX_EDITABLE_AGE_HOURS = 48;

/**
 * Use case for updating an ad
 *
 * Публикацией и снятием сообщений занимается `adPublishing.js` (Telegram) и
 * `maxAdPublishing.js` (MAX); здесь остаётся решение «что сделать» по статусу и
 * по выбранному режиму обновления.
 */
export class UpdateAdUseCase {
  constructor(
    adRepository,
    telegramService,
    telegramChatRepository,
    maxService,
    maxChatRepository
  ) {
    this.adRepository = adRepository;
    this.telegramService = telegramService;
    this.telegramChatRepository = telegramChatRepository;
    this.maxService = maxService;
    this.maxChatRepository = maxChatRepository;
  }

  async execute(
    adId,
    updateData,
    authenticatedUserId,
    telegramUpdateType = null,
    selectedChats = [],
    selectedMaxChats = []
  ) {
    const ad = await this.adRepository.findById(adId);

    if (!ad) {
      throw new NotFoundError("Ad");
    }

    if (!ad.belongsToUser(authenticatedUserId)) {
      throw new AuthorizationError("You can only update your own ads");
    }

    const oldStatus = ad.status;
    const newStatus = updateData.status;
    const statusChanged = Boolean(newStatus && newStatus !== oldStatus);

    const updatedAd = await this.adRepository.update(adId, updateData);

    logger.info("Ad updated successfully", {
      ad_id: adId,
      user_id: authenticatedUserId,
      status_changed: statusChanged,
      old_status: oldStatus,
      new_status: newStatus,
    });

    // Сбой Telegram не должен отменять уже сохранённое обновление — поэтому обе
    // ветки идут под `#tryTelegram`.
    if (statusChanged && (newStatus === "archive" || newStatus === "deleted")) {
      await this.#tryTelegram(newStatus, adId, async () => {
        const messages = await this.adRepository.getTelegramMessagesByAdId(adId);

        if (!messages.length) return;

        await removeAdFromChats({
          messages,
          telegramService: this.telegramService,
          adRepository: this.adRepository,
          adId,
          reason: newStatus,
        });
      });

      await this.#tryMax(newStatus, adId, async () => {
        const messages = await this.adRepository.getMaxMessagesByAdId(adId);

        if (!messages.length) return;

        await removeAdFromMaxChats({
          messages,
          maxService: this.maxService,
          adRepository: this.adRepository,
          adId,
          reason: newStatus,
        });
      });
    }

    if (telegramUpdateType === "delete_and_repost") {
      await this.#tryTelegram("delete_and_repost", adId, () =>
        this.#repost(adId, selectedChats)
      );
      await this.#tryMax("max repost", adId, () => this.#repostMax(adId, selectedMaxChats));
    } else if (telegramUpdateType === "update_text") {
      await this.#tryTelegram("update_text", adId, () =>
        this.#editOrRepost(adId, updatedAd, selectedChats)
      );
      // Правки текста у MAX не проверяли живьём, поэтому обновление текста —
      // всегда снял старое и опубликовал заново.
      await this.#tryMax("max update_text", adId, () => this.#repostMax(adId, selectedMaxChats));
    }

    return updatedAd;
  }

  /** Снимаем старые сообщения и публикуем заново — туда же или в выбранные чаты. */
  async #repost(adId, selectedChats, sourceMessages = null) {
    const messages =
      sourceMessages ?? (await this.adRepository.getTelegramMessagesByAdId(adId));
    const groups = chatGroupsFor({ selectedChats, messages });

    if (groups.size === 0) {
      logger.info("No Telegram chats to update, skipping", { ad_id: adId });
      return;
    }

    if (messages.length > 0) {
      await clearChatsForRepost({
        messages,
        telegramService: this.telegramService,
        adRepository: this.adRepository,
        adId,
      });
    }

    const refreshedAd = await this.adRepository.findById(adId);

    if (!refreshedAd) {
      throw new Error("Failed to load refreshed ad");
    }

    if (!refreshedAd.images?.length) {
      logger.warn("No images found for repost, sending text-only", { ad_id: adId });
    }

    const chats = await resolveChatTargets({
      groups,
      telegramChatRepository: this.telegramChatRepository,
      adId,
    });

    await publishToChats({ ad: refreshedAd, chats, telegramService: this.telegramService });
  }

  async #editOrRepost(adId, updatedAd, selectedChats) {
    const messages = await this.adRepository.getTelegramMessagesByAdId(adId);
    const groups = chatGroupsFor({ selectedChats, messages });

    if (groups.size === 0) {
      logger.info("No Telegram messages or selected chats found for ad, skipping", {
        ad_id: adId,
      });
      return;
    }

    const { tooOld, failed } = await this.#editMessages(adId, updatedAd, messages);

    if (!tooOld && failed.length === 0) {
      logger.info(`Updated ${messages.length}/${messages.length} Telegram messages`, {
        ad_id: adId,
      });
      return;
    }

    logger.info("Reposting because messages are too old or some edits failed", {
      ad_id: adId,
      too_old: tooOld,
      failed_count: failed.length,
    });

    await this.#repost(adId, selectedChats, messages);
  }

  async #editMessages(adId, updatedAd, messages) {
    const failed = [];

    for (const message of messages) {
      const hoursOld = (Date.now() - new Date(message.created_at)) / 3_600_000;

      if (hoursOld > MAX_EDITABLE_AGE_HOURS) {
        logger.info("Message is too old to edit, will repost instead", {
          ad_id: adId,
          message_id: String(message.message_id),
          hours_old: Number(hoursOld.toFixed(1)),
        });
        return { tooOld: true, failed };
      }

      try {
        const result = await this.telegramService.updateAdStatus(
          updatedAd,
          String(message.chat_id),
          String(message.message_id),
          message.thread_id ? String(message.thread_id) : null
        );

        if (!result?.success) {
          failed.push(message);
        }
      } catch (err) {
        logger.error("Failed to update Telegram message", {
          ad_id: adId,
          chat_id: String(message.chat_id),
          message_id: String(message.message_id),
          error: err.message,
        });
        failed.push(message);
      }

      await sleep(MESSAGE_OPERATION_DELAY_MS);
    }

    return { tooOld: false, failed };
  }

  async #tryTelegram(step, adId, operation) {
    try {
      await operation();
    } catch (err) {
      logger.error("Failed to handle Telegram updates", {
        ad_id: adId,
        step,
        error: err.message,
        stack: err.stack,
      });
      // Не пробрасываем: объявление уже сохранено, и сбой Telegram не должен
      // выглядеть для пользователя как несохранившаяся правка.
    }
  }

  /** То же правило для MAX: сбой бота не превращает сохранённую правку в ошибку. */
  async #tryMax(step, adId, operation) {
    try {
      await operation();
    } catch (err) {
      logger.error("Failed to handle MAX updates", {
        ad_id: adId,
        step,
        error: err.message,
        stack: err.stack,
      });
    }
  }

  /**
   * Repost в MAX: снимаем прежние сообщения и публикуем заново — в выбранные
   * чаты, а если пользователь ничего не выбрал, в те же, где объявление уже
   * лежало (их даёт журнал).
   */
  async #repostMax(adId, selectedMaxChats) {
    const messages = await this.adRepository.getMaxMessagesByAdId(adId);
    const chats = await this.#resolveMaxTargets(adId, selectedMaxChats, messages);

    if (chats.length === 0) {
      logger.info("No MAX chats to update, skipping", { ad_id: adId });
      return;
    }

    if (messages.length > 0) {
      await removeAdFromMaxChats({
        messages,
        maxService: this.maxService,
        adRepository: this.adRepository,
        adId,
        reason: "repost",
      });
    }

    const refreshedAd = await this.adRepository.findById(adId);

    if (!refreshedAd) {
      throw new Error("Failed to load refreshed ad");
    }

    await publishToMaxChats({
      ad: refreshedAd,
      chats,
      maxService: this.maxService,
      adRepository: this.adRepository,
    });
  }

  async #resolveMaxTargets(adId, selectedMaxChats, messages) {
    if (selectedMaxChats?.length > 0) {
      const active = await this.maxChatRepository.getActiveChats("ads", false);
      const chosen = new Set(selectedMaxChats.map(String));

      return active
        .filter((chat) => chosen.has(String(chat.id)))
        .map((chat) => ({ chat_id: chat.chat_id }));
    }

    return messages.map((message) => ({ chat_id: message.chat_id }));
  }
}
