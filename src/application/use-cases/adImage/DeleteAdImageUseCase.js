import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for deleting a single ad image
 */
export class DeleteAdImageUseCase {
  constructor(adImageRepository) {
    this.adImageRepository = adImageRepository;
  }

  async execute(imageId) {
    // Check if image exists
    const image = await this.adImageRepository.findById(imageId);
    if (!image) {
      throw new NotFoundError("Image");
    }

    // Delete image
    const deleted = await this.adImageRepository.deleteById(imageId);

    if (deleted) {
      logger.info("Ad image deleted", { image_id: imageId });
    }

    return deleted;
  }
}
