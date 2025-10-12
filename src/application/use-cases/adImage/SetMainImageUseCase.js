import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for setting an image as main
 */
export class SetMainImageUseCase {
  constructor(adImageRepository) {
    this.adImageRepository = adImageRepository;
  }

  async execute(imageId, adId, postId) {
    // Check if image exists
    const image = await this.adImageRepository.findById(imageId);
    if (!image) {
      throw new NotFoundError("Image");
    }

    // Set as main
    const success = await this.adImageRepository.setMainImage(
      imageId,
      adId,
      postId
    );

    if (success) {
      logger.info("Main image set", {
        image_id: imageId,
        ad_id: adId,
        post_id: postId,
      });
    }

    return success;
  }
}
