import { canSeeAd } from "../../../core/utils/adVisibility.js";

/**
 * Use case for getting images by ID (tries ad_id first, then post_id)
 *
 * Если id оказался снятым или удалённым объявлением, ответ пустой — до `post_id`
 * дело не доходит, иначе номер объявления случайно отдал бы картинки чужой
 * заметки.
 */
export class GetImagesByIdUseCase {
  constructor(adImageRepository, adRepository) {
    this.adImageRepository = adImageRepository;
    this.adRepository = adRepository;
  }

  async execute(id, viewer = null) {
    const ad = await this.adRepository.findById(id);

    if (ad) {
      if (!canSeeAd(ad, viewer)) return [];

      return await this.adImageRepository.findByAdId(id);
    }

    return await this.adImageRepository.findByPostId(id);
  }
}
