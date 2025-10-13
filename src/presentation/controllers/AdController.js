import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";

/**
 * Ad Controller - handles HTTP requests for ads
 */
export class AdController {
  constructor(
    getAdsUseCase,
    getAdByIdUseCase,
    createAdUseCase,
    updateAdUseCase,
    deleteAdUseCase
  ) {
    this.getAdsUseCase = getAdsUseCase;
    this.getAdByIdUseCase = getAdByIdUseCase;
    this.createAdUseCase = createAdUseCase;
    this.updateAdUseCase = updateAdUseCase;
    this.deleteAdUseCase = deleteAdUseCase;
  }

  /**
   * Get all ads
   */
  getAds = asyncHandler(async (req, res) => {
    const { status, category, subcategory, sort, order, page, limit } =
      req.query;

    const filters = { status, category, subcategory, sort, order };
    const pagination = { page, limit };

    const result = await this.getAdsUseCase.execute(filters, pagination);

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
    const ad = await this.getAdByIdUseCase.execute(Number(id), false);

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
    const ad = await this.getAdByIdUseCase.execute(Number(id), true);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { view_count: ad.view_count },
    });
  });

  /**
   * Create new ad
   */
  createAd = asyncHandler(async (req, res) => {
    const { selectedChatIds, ...adData } = req.body;
    const authenticatedUserId = req.user.user_id;

    const ad = await this.createAdUseCase.execute(
      adData,
      authenticatedUserId,
      selectedChatIds
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
    const { telegramUpdateType, ...updateData } = req.body;
    const authenticatedUserId = req.user.user_id;

    const ad = await this.updateAdUseCase.execute(
      Number(id),
      updateData,
      authenticatedUserId,
      telegramUpdateType
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
}
