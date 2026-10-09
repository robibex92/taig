import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";
import { assertCanEditImages } from "./imageAccess.js";

/**
 * Use case for deleting a single ad image
 */
export class DeleteAdImageUseCase {
  constructor(adImageRepository, adRepository, postRepository) {
    this.adImageRepository = adImageRepository;
    this.adRepository = adRepository;
    this.postRepository = postRepository;
  }

  async execute(imageId, user) {
    const image = await this.adImageRepository.findById(imageId);
    if (!image) {
      throw new NotFoundError("Image");
    }

    await assertCanEditImages(
      { adRepository: this.adRepository, postRepository: this.postRepository },
      [image],
      user
    );

    const deleted = await this.adImageRepository.deleteById(imageId);

    if (deleted) {
      logger.info("Ad image deleted", { image_id: imageId });
    }

    return deleted;
  }
}
