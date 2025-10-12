import { ValidationError } from "../../core/errors/AppError.js";
import {
  maxAuthSchema,
  linkMaxSchema,
  linkTelegramSchema,
  unlinkPlatformSchema,
  updatePlatformSettingsSchema,
} from "../../core/validation/schemas/maxAuth.schema.js";

/**
 * MAX Authentication Controller
 * Handles MAX Platform authentication and account linking
 */
class MaxAuthController {
  constructor({
    authenticateMaxUserUseCase,
    linkMaxAccountUseCase,
    linkTelegramAccountUseCase,
    unlinkPlatformUseCase,
    updatePlatformSettingsUseCase,
    getPlatformsInfoUseCase,
  }) {
    this.authenticateMaxUserUseCase = authenticateMaxUserUseCase;
    this.linkMaxAccountUseCase = linkMaxAccountUseCase;
    this.linkTelegramAccountUseCase = linkTelegramAccountUseCase;
    this.unlinkPlatformUseCase = unlinkPlatformUseCase;
    this.updatePlatformSettingsUseCase = updatePlatformSettingsUseCase;
    this.getPlatformsInfoUseCase = getPlatformsInfoUseCase;
  }

  /**
   * Authenticate user via MAX Platform
   * POST /api/v1/auth/max
   */
  async authenticateMax(req, res, next) {
    try {
      const { error, value } = maxAuthSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      // Extract device info from request
      const deviceInfo = {
        device: req.body.device || null,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      };

      const result = await this.authenticateMaxUserUseCase.execute({
        ...value,
        deviceInfo,
      });

      // Set refresh token in httpOnly cookie
      res.cookie("refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Link MAX account to existing user
   * POST /api/v1/auth/link-max
   */
  async linkMax(req, res, next) {
    try {
      const { error, value } = linkMaxSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const result = await this.linkMaxAccountUseCase.execute({
        userId: req.user.id,
        ...value,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: "MAX account linked successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Link Telegram account to existing user
   * POST /api/v1/auth/link-telegram
   */
  async linkTelegram(req, res, next) {
    try {
      const { error, value } = linkTelegramSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const result = await this.linkTelegramAccountUseCase.execute({
        userId: req.user.id,
        ...value,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: "Telegram account linked successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unlink platform from user account
   * POST /api/v1/auth/unlink-platform
   */
  async unlinkPlatform(req, res, next) {
    try {
      const { error, value } = unlinkPlatformSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const result = await this.unlinkPlatformUseCase.execute({
        userId: req.user.id,
        platform: value.platform,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update platform settings (primary platform)
   * PATCH /api/v1/auth/settings
   */
  async updateSettings(req, res, next) {
    try {
      const { error, value } = updatePlatformSettingsSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const result = await this.updatePlatformSettingsUseCase.execute({
        userId: req.user.id,
        primary_platform: value.primary_platform,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's linked platforms info
   * GET /api/v1/auth/platforms
   */
  async getPlatforms(req, res, next) {
    try {
      const result = await this.getPlatformsInfoUseCase.execute({
        userId: req.user.id,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default MaxAuthController;
