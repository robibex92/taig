import { canSeeAd } from "../../../core/utils/adVisibility.js";

/**
 * Use case for getting ad images
 *
 * Фотографии следуют видимости самого объявления: снимки снятого с публикации
 * или удалённого объявления остаются доступны только автору и модерации. Иначе
 * «удалил объявление» оставляло бы его картинки открытыми по `ad_id`.
 */
export class GetAdImagesUseCase {
  constructor(adImageRepository, adRepository) {
    this.adImageRepository = adImageRepository;
    this.adRepository = adRepository;
  }

  async execute(adId, postId, viewer = null) {
    if (adId) {
      const ad = await this.adRepository.findById(adId);
      if (!canSeeAd(ad, viewer)) return [];

      return await this.adImageRepository.findByAdId(adId);
    } else if (postId) {
      return await this.adImageRepository.findByPostId(postId);
    }
    return [];
  }
}
