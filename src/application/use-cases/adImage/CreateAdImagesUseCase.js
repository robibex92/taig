import { logger } from "../../../core/utils/logger.js";
import { ValidationError } from "../../../core/errors/AppError.js";
import {
  assertCanEditAd,
  assertCanEditPost,
} from "./imageAccess.js";

/**
 * Use case for creating ad images
 *
 * Право на добавление снимка проверяется здесь же: без этого любой вошедший
 * мог дописать фотографию к чужому объявлению, назвав его `ad_id`.
 */
export class CreateAdImagesUseCase {
  constructor(adImageRepository, adRepository, postRepository) {
    this.adImageRepository = adImageRepository;
    this.adRepository = adRepository;
    this.postRepository = postRepository;
  }

  async execute(adId, postId, images, serverUrl, user) {
    if (adId) {
      await assertCanEditAd(this.adRepository, adId, user);
    } else if (postId) {
      await assertCanEditPost(this.postRepository, postId, user);
    } else {
      throw new ValidationError("Нужен ad_id или post_id");
    }

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
