import { AD_STATUS } from "../../../core/constants/index.js";
import { NotFoundError } from "../../../core/errors/AppError.js";
import { isModerator } from "../../../core/utils/roles.js";

/**
 * Снятое с публикации и удалённое объявление живёт по своей ссылке только для
 * автора и модерации. Для всех остальных оно ведёт себя как несуществующее:
 * иначе «удалил объявление» означало бы «ссылка на него работает вечно».
 *
 * `user_id` в Prisma — BigInt, поэтому сравнение через `String()`.
 */
const canSeeInactiveAd = (ad, viewer) =>
  Boolean(viewer) &&
  (String(viewer.user_id) === String(ad.user_id) || isModerator(viewer));

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

    if (ad.status !== AD_STATUS.ACTIVE && !canSeeInactiveAd(ad, viewer)) {
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
