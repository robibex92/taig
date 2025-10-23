import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";

/**
 * Banner Controller - handles banner-related requests
 */
export class BannerController {
  constructor(
    getBannersUseCase,
    getBannerByIdUseCase,
    createBannerUseCase,
    updateBannerUseCase,
    deleteBannerUseCase,
    toggleBannerStatusUseCase,
    clickBannerUseCase
  ) {
    this.getBannersUseCase = getBannersUseCase;
    this.getBannerByIdUseCase = getBannerByIdUseCase;
    this.createBannerUseCase = createBannerUseCase;
    this.updateBannerUseCase = updateBannerUseCase;
    this.deleteBannerUseCase = deleteBannerUseCase;
    this.toggleBannerStatusUseCase = toggleBannerStatusUseCase;
    this.clickBannerUseCase = clickBannerUseCase;
  }

  /**
   * Get all banners
   */
  getBanners = asyncHandler(async (req, res) => {
    const { page = 0, limit = 10, is_active, position } = req.query;
    const filters = { is_active, position };
    const pagination = { page: parseInt(page), limit: parseInt(limit) };

    const result = await this.getBannersUseCase.execute(filters, pagination);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.banners,
      pagination: result.pagination,
    });
  });

  /**
   * Get banner by ID
   */
  getBannerById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const banner = await this.getBannerByIdUseCase.execute(Number(id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: banner,
    });
  });

  /**
   * Create new banner
   */
  createBanner = asyncHandler(async (req, res) => {
    const bannerData = req.body;

    const banner = await this.createBannerUseCase.execute(bannerData);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: banner,
      message: "Баннер создан успешно",
    });
  });

  /**
   * Update banner
   */
  updateBanner = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const bannerData = req.body;

    const banner = await this.updateBannerUseCase.execute(
      Number(id),
      bannerData
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: banner,
      message: "Баннер обновлен успешно",
    });
  });

  /**
   * Delete banner
   */
  deleteBanner = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await this.deleteBannerUseCase.execute(Number(id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Баннер удален успешно",
    });
  });

  /**
   * Toggle banner status
   */
  toggleBannerStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    const banner = await this.toggleBannerStatusUseCase.execute(
      Number(id),
      is_active
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: banner,
      message: "Статус баннера изменен",
    });
  });

  /**
   * Track banner click
   */
  clickBanner = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await this.clickBannerUseCase.execute(Number(id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Клик зарегистрирован",
    });
  });

  /**
   * Track banner view
   */
  trackBannerView = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // TODO: Implement view tracking logic
    // For now, just return success
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Просмотр зарегистрирован",
    });
  });
}
