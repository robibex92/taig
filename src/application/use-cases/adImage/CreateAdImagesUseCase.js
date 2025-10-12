import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for creating ad images
 */
export class CreateAdImagesUseCase {
  constructor(adImageRepository, adRepository, postRepository) {
    this.adImageRepository = adImageRepository;
    this.adRepository = adRepository;
    this.postRepository = postRepository;
  }

  async execute(adId, postId, images, serverUrl) {
    // Verify that ad or post exists
    if (adId) {
      const ad = await this.adRepository.findById(adId);
      if (!ad) {
        throw new NotFoundError("Ad");
      }
    } else if (postId) {
      const post = await this.postRepository.findById(postId);
      if (!post) {
        throw new NotFoundError("Post");
      }
    }

    // Create images
    const createdImages = await this.adImageRepository.createMultiple(
      adId,
      postId,
      images,
      serverUrl
    );

    logger.info("Ad images created", {
      ad_id: adId,
      post_id: postId,
      count: createdImages.length,
    });

    return createdImages;
  }
}
