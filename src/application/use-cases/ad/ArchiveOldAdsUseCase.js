import { adLifetimeDays } from "../../../core/constants/index.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Авто-архив устаревших объявлений.
 *
 * Объявление устаревает через `AD_LIFETIME_DAYS` (по умолчанию 30) дней после
 * последней правки: якорь — `ads.updated_at`, а у строки без правок —
 * `created_at`. Правка объявления или «отметить актуальность» срок продлевают.
 *
 * Из чатов объявления не удаляются: archived — это только про витрину.
 */
export class ArchiveOldAdsUseCase {
  constructor(adRepository) {
    this.adRepository = adRepository;
  }

  async execute(days = adLifetimeDays()) {
    const archived = await this.adRepository.archiveOldAds(days);

    logger.info("Auto-archive finished", { archived, days });

    return { archived, days };
  }
}
