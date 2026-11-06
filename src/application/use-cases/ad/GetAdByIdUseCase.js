import { NotFoundError } from "../../../core/errors/AppError.js";
import { canSeeAd } from "../../../core/utils/adVisibility.js";

/**
 * Снятое с публикации и удалённое объявление живёт по своей ссылке только для
 * автора и модерации. Для всех остальных оно ведёт себя как несуществующее:
 * иначе «удалил объявление» означало бы «ссылка на него работает вечно».
 *
 * Само правило в `canSeeAd` — его проверяют и фотографии объявления.
 */

/**
 * Use case for getting an ad by ID
 */
export class GetAdByIdUseCase {
  constructor(adRepository) {
    this.adRepository = adRepository;
  }

  /**
   * @param {number} adId
   * @param {boolean} incrementViewCount
   * @param {{user_id: bigint|string, roles?: string[]}|null} viewer — смотрит
   *   запрос автор или модерация; гостю равен `null`.
   */
  async execute(adId, incrementViewCount = false, viewer = null) {
    const ad = await this.adRepository.findById(adId);

    if (!ad) {
      throw new NotFoundError("Ad");
    }

    if (!canSeeAd(ad, viewer)) {
      throw new NotFoundError("Ad");
    }

    // Optionally increment view count
    if (incrementViewCount) {
      await this.adRepository.incrementViewCount(adId);
      ad.incrementViewCount();
    }

    return ad;
  }
}
