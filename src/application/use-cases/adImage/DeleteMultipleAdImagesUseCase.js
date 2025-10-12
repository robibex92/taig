import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for deleting multiple ad images
 */
export class DeleteMultipleAdImagesUseCase {
  constructor(adImageRepository) {
    this.adImageRepository = adImageRepository;
  }

  async execute(imageIds) {
    const deletedCount = await this.adImageRepository.deleteMultiple(imageIds);

    logger.info("Multiple ad images deleted", {
      count: deletedCount,
      ids: imageIds,
    });

    return deletedCount;
  }
}
