import {
  NotFoundError,
  AuthorizationError,
} from "../../../core/errors/AppError.js";
import { adExpiresAt, adLifetimeDays } from "../../../core/constants/index.js";
import { isModerator } from "../../../core/utils/roles.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * «Отметить актуальность» — продлевает срок жизни объявления.
 *
 * Двигается только якорь устаревания (`updated_at`), содержимое объявления не
 * меняется, поэтому история правок остаётся честной.
 */
export class MarkAdRelevantUseCase {
  constructor(adRepository) {
    this.adRepository = adRepository;
  }

  async execute(adId, user) {
    const ad = await this.adRepository.findById(adId);

    if (!ad) {
      throw new NotFoundError("Ad");
    }

    const isOwner = ad.belongsToUser(user?.user_id);

    if (!isOwner && !isModerator(user)) {
      throw new AuthorizationError("You can only renew your own ads");
    }

    const touchedAt = new Date();
    await this.adRepository.markRelevant(adId);

    logger.info("Ad marked relevant", { ad_id: adId, user_id: user?.user_id });

    return {
      id: String(ad.id),
      lifetimeDays: adLifetimeDays(),
      expiresAt: adExpiresAt(touchedAt).toISOString(),
    };
  }
}
