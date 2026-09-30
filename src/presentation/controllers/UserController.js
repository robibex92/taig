import { AD_STATUS, HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { isModerator } from "../../core/utils/roles.js";

/**
 * User Controller - handles user-related requests
 */
export class UserController {
  constructor(
    updateUserUseCase,
    userRepository,
    adRepository,
    uploadAvatarUseCase = null
  ) {
    this.updateUserUseCase = updateUserUseCase;
    this.userRepository = userRepository;
    this.adRepository = adRepository;
    this.uploadAvatarUseCase = uploadAvatarUseCase;
  }

  /**
   * Get current user
   */
  getCurrentUser = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const user = await this.userRepository.findById(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user.toJSON(),
    });
  });

  /**
   * Get user by ID (public)
   */
  getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await this.userRepository.findById(Number(id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user.toPublicJSON(),
    });
  });

  /**
   * Get user avatar by ID (public)
   */
  getUserAvatar = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await this.userRepository.findById(Number(id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        photo_url: user.avatar || null,
        user_id: user.user_id,
      },
    });
  });

  /**
   * Update current user profile
   */
  updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const updateData = req.body;

    const user = await this.updateUserUseCase.execute(
      userId,
      updateData,
      userId
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user.toJSON(),
      message: "Profile updated successfully",
    });
  });

  /**
   * Get current user's role list
   */
  getUserRoles = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const user = await this.userRepository.findById(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { roles: user.roles || [] },
    });
  });

  /**
   * Список объявлений пользователя.
   *
   * `status` без значения по умолчанию: страница «Мои объявления» просит либо
   * все состояния разом, либо одну вкладку — а разбивку по состояниям и сумму
   * просмотров отдаёт `summary`, потому что посчитать их по одной странице
   * нельзя.
   *
   * Маршрут публичный (страница продавца), поэтому чужие «архив» и «удалённые»
   * наружу не отдаются: не-владелец видит только активные.
   */
  getUserAds = asyncHandler(async (req, res) => {
    const { user_id } = req.params;
    const { status, category, subcategory, search, sort, order, page, limit } =
      req.query;

    // `req.user.user_id` — BigInt из Prisma, `user_id` из пути — строка: `===`
    // у разных типов всегда false, и владелец не узнавался бы никогда.
    const isOwner = !!req.user && String(req.user.user_id) === String(user_id);
    const canSeeAll = isOwner || isModerator(req.user);

    const filters = {
      status: canSeeAll ? status : AD_STATUS.ACTIVE,
      category,
      subcategory,
      search,
      sort,
      order,
      limit,
      offset: (page - 1) * limit,
    };

    const [{ ads, total }, summary] = await Promise.all([
      this.adRepository.findByUserId(Number(user_id), filters),
      canSeeAll
        ? this.adRepository.summarizeForUser(Number(user_id), {
            category,
            subcategory,
            search,
          })
        : null,
    ]);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: ads.map((ad) => ad.toJSON()),
      // Та же форма ответа, что у `GET /api/ads`: страница — в `pagination`.
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      ...(summary && { summary }),
    });
  });

  /**
   * Upload user avatar
   */
  uploadAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user.user_id;
    const user = await this.uploadAvatarUseCase.execute(userId, req.file.path);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: user.toJSON(),
      message: "Avatar uploaded successfully",
    });
  });
}
