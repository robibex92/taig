import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";
import { assertCanEditImages } from "./imageAccess.js";

/**
 * Use case for deleting multiple ad images
 */
export class DeleteMultipleAdImagesUseCase {
  constructor(adImageRepository, adRepository, postRepository) {
    this.adImageRepository = adImageRepository;
    this.adRepository = adRepository;
    this.postRepository = postRepository;
  }

  async execute(imageIds, user) {
    const images = [];

    for (const imageId of imageIds) {
      const image = await this.adImageRepository.findById(imageId);

      if (!image) {
        throw new NotFoundError("Image");
      }

      images.push(image);
    }

    // Один раз для всей пачки: права считаются по хозяевам найденных снимков,
    // а не по `ad_id` из тела запроса.
    await assertCanEditImages(
      { adRepository: this.adRepository, postRepository: this.postRepository },
      images,
      user
    );

    const deletedCount = await this.adImageRepository.deleteMultiple(imageIds);

    logger.info("Multiple ad images deleted", {
      count: deletedCount,
      ids: imageIds,
    });

    return deletedCount;
  }
}
