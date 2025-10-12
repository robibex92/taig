const {
  NotFoundError,
  ValidationError,
} = require("../../../core/errors/AppError");

/**
 * Extend Ad Use Case
 * Extends the expiration date of an ad by 30 days
 */
class ExtendAdUseCase {
  constructor({ adRepository }) {
    this.adRepository = adRepository;
  }

  async execute({ ad_id, user_id }) {
    // Get ad
    const ad = await this.adRepository.findById(ad_id);
    if (!ad) {
      throw new NotFoundError("Ad not found");
    }

    // Check if user owns the ad
    if (ad.user_id !== user_id) {
      throw new ValidationError(
        "Unauthorized: You can only extend your own ads"
      );
    }

    // Check if ad can be extended
    if (ad.status !== "active" && ad.status !== "archived") {
      throw new ValidationError("Only active or archived ads can be extended");
    }

    // Check max extensions limit
    const MAX_EXTENSIONS = parseInt(process.env.AD_MAX_EXTENSIONS || "3");
    if (ad.extended_count >= MAX_EXTENSIONS) {
      throw new ValidationError(
        `Maximum extensions (${MAX_EXTENSIONS}) reached`
      );
    }

    // Calculate new expiration date (current or now + 30 days)
    const EXTENSION_DAYS = parseInt(process.env.AD_EXPIRATION_DAYS || "30");
    const baseDate =
      ad.expires_at && new Date(ad.expires_at) > new Date()
        ? new Date(ad.expires_at)
        : new Date();

    const newExpiresAt = new Date(baseDate);
    newExpiresAt.setDate(newExpiresAt.getDate() + EXTENSION_DAYS);

    // Update ad
    const updatedAd = await this.adRepository.update(ad_id, {
      expires_at: newExpiresAt,
      extended_count: ad.extended_count + 1,
      status: "active", // Reactivate if archived
    });

    return updatedAd;
  }
}

module.exports = ExtendAdUseCase;
