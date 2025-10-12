import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * Use case for getting an ad by ID
 */
export class GetAdByIdUseCase {
  constructor(adRepository) {
    this.adRepository = adRepository;
  }

  async execute(adId, incrementViewCount = false) {
    const ad = await this.adRepository.findById(adId);

    if (!ad) {
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
