import { AD_STATUS, HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { logger } from "../../core/utils/logger.js";
import { isAdmin, isModerator } from "../../core/utils/roles.js";
import {
  AuthorizationError,
  ValidationError,
} from "../../core/errors/AppError.js";

/**
 * Ad Controller - handles HTTP requests for ads
 */
export class AdController {
  constructor({
    getAdsUseCase,
    getAdByIdUseCase,
    createAdUseCase,
    updateAdUseCase,
    deleteAdUseCase,
    markAdRelevantUseCase,
    adRepository,
    telegramService,
  }) {
    this.getAdsUseCase = getAdsUseCase;
    this.getAdByIdUseCase = getAdByIdUseCase;
    this.createAdUseCase = createAdUseCase;
    this.updateAdUseCase = updateAdUseCase;
    this.deleteAdUseCase = deleteAdUseCase;
    this.markAdRelevantUseCase = markAdRelevantUseCase;
    this.adRepository = adRepository;
    this.telegramService = telegramService;
  }

  /**
   * Get all ads
   */
  getAds = asyncHandler(async (req, res) => {
    const {
      status,
      category,
      subcategory,
      sort,
      order,
      page,
      limit,
      priceMin,
      priceMax,
      dateFrom,
      dateTo,
      search,
      onlyMyHouse,
    } = req.query;

    const filters = {
      // Снятые и удалённые объявления витрина не отдаёт: статус выбирает
      // смотритель по правам, а не тот, кто прислал запрос. Иначе `?status=archive`
      // вываливал чужие архивы в общий список.
      status: isModerator(req.user) ? status : AD_STATUS.ACTIVE,
      category,
      subcategory,
      sort,
      order,
      priceMin,
      priceMax,
      dateFrom,
      dateTo,
      search,
      onlyMyHouse,
    };
    const pagination = { page, limit };

    const result = await this.getAdsUseCase.execute(filters, pagination, req.user ?? null);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.ads.map((ad) => ad.toJSON()),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  });

  /**
   * Get ad by ID
   */
  getAdById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ad = await this.getAdByIdUseCase.execute(Number(id), false, req.user ?? null);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: ad.toJSON(),
    });
  });

  /**
   * Increment ad view count
   */
  incrementViewCount = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ad = await this.getAdByIdUseCase.execute(Number(id), true, req.user ?? null);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { view_count: ad.view_count },
    });
  });

  /**
   * Create new ad
   */
  createAd = asyncHandler(async (req, res) => {
    const { selectedChats, selectedMaxChats, ...adData } = req.body;
    const authenticatedUserId = req.user.user_id;
    const ad = await this.createAdUseCase.execute(
      adData,
      authenticatedUserId,
      selectedChats || [],
      selectedMaxChats || []
    );
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: ad.toJSON(),
      message: "Ad created successfully",
    });
  });

  /**
   * Update ad
   */
  updateAd = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { telegramUpdateType, selectedChats, selectedMaxChats, ...updateData } = req.body;
    const authenticatedUserId = req.user.user_id;

    const ad = await this.updateAdUseCase.execute(
      Number(id),
      updateData,
      authenticatedUserId,
      telegramUpdateType,
      selectedChats,
      selectedMaxChats || []
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: ad.toJSON(),
      message: "Ad updated successfully",
    });
  });

  /**
   * Delete ad
   */
  deleteAd = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const authenticatedUserId = req.user.user_id;

    await this.deleteAdUseCase.execute(Number(id), authenticatedUserId, true);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Ad deleted successfully",
    });
  });

  /**
   * «Отметить актуальность» — продлевает срок авто-архива
   */
  markRelevant = asyncHandler(async (req, res) => {
    const result = await this.markAdRelevantUseCase.execute(
      Number(req.params.id),
      req.user
    );

    res.json({ success: true, data: result });
  });

  /**
   * Permanently delete ad (hard delete)
   */
  permanentDeleteAd = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const authenticatedUserId = req.user.user_id;

    // Правого просмотра здесь нет: удаляем именно своё снятое объявление, а
    // модератору разрешает правило внутри кейса.
    const ad = await this.getAdByIdUseCase.execute(
      Number(id),
      false,
      req.user ?? null
    );

    if (String(ad.user_id) !== String(authenticatedUserId) && !isAdmin(req.user)) {
      throw new AuthorizationError("Можно удалять только свои объявления");
    }

    if (ad.status !== AD_STATUS.DELETED) {
      throw new ValidationError(
        "Объявление нужно сначала удалить — навсегда стираются только удалённые"
      );
    }

    // Delete from Telegram BEFORE deleting from database
    try {
      const telegramMessages =
        await this.adRepository.getTelegramMessagesByAdId(Number(id));

      if (telegramMessages && telegramMessages.length > 0) {
        logger.info(
          `Deleting ${telegramMessages.length} Telegram messages for ad ${id} from all chats`,
          {
            ad_id: id,
            message_count: telegramMessages.length,
          }
        );

        // Delete each message from Telegram (all chats/threads where it was posted)
        const deletePromises = telegramMessages.map(async (msg) => {
          try {
            return await this.telegramService.deleteMessage({
              chatId: msg.chat_id,
              messageId: msg.message_id,
              threadId: msg.thread_id || undefined,
            });
          } catch (err) {
            logger.error(
              `Failed to delete Telegram message ${msg.message_id} from chat ${msg.chat_id}`,
              {
                error: err.message,
                chat_id: msg.chat_id,
                message_id: msg.message_id,
                ad_id: id,
              }
            );
            // Continue even if some messages fail to delete
            return { success: false, error: err.message };
          }
        });

        const results = await Promise.allSettled(deletePromises);
        const successCount = results.filter(
          (r) => r.status === "fulfilled" && r.value?.success
        ).length;

        logger.info(
          `Deleted ${successCount}/${telegramMessages.length} Telegram messages for permanently deleted ad`,
          {
            ad_id: id,
            success_count: successCount,
            total_count: telegramMessages.length,
          }
        );
      }
    } catch (err) {
      logger.error(
        "Failed to delete Telegram messages, but continuing with database deletion",
        {
          error: err.message,
          ad_id: id,
        }
      );
      // Don't throw - we still want to delete from database even if Telegram fails
    }

    // Now delete from database (includes telegram_messages table cascade)
    await this.adRepository.permanentDelete(Number(id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Ad permanently deleted from database and Telegram",
    });
  });

  /**
   * Get telegram messages for an ad
   */
  /**
   * Журнал публикаций объявления (в какие чаты и какими сообщениями).
   *
   * Нужен только редактору объявления, и наружу он отдаёт `chat_id` домашних
   * чатов дома, поэтому доступ — автор или модерация.
   */
  getTelegramMessages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const ad = await this.getAdByIdUseCase.execute(Number(id), false, req.user ?? null);

    if (String(ad.user_id) !== String(req.user.user_id) && !isModerator(req.user)) {
      throw new AuthorizationError("Журнал публикаций виден только автору объявления");
    }

    const messages = await this.adRepository.getTelegramMessagesByAdId(
      Number(id)
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: messages,
    });
  });
}
