import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";

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
   * Get current user status
   */
  getUserStatus = asyncHandler(async (req, res) => {
    const userId = req.user.user_id;
    const user = await this.userRepository.findById(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { status: user.status },
    });
  });

  /**
   * Get user's ads
   */
  getUserAds = asyncHandler(async (req, res) => {
    const { user_id } = req.params;
    const { status, sort, order } = req.query;

    const filters = { status, sort, order };
    const ads = await this.adRepository.findByUserId(Number(user_id), filters);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: ads.map((ad) => ad.toJSON()),
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
