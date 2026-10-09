import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";
import { assertCanEditImages } from "./imageAccess.js";

/**
 * Use case for setting an image as main
 */
export class SetMainImageUseCase {
  constructor(adImageRepository, adRepository, postRepository) {
    this.adImageRepository = adImageRepository;
    this.adRepository = adRepository;
    this.postRepository = postRepository;
  }

  /**
   * Хозяин снимка берётся из строки `ad_images`, а не из тела запроса: в теле
   * клиент может назвать чужой `ad_id`, и по нему проверялись бы не те права.
   */
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

    const success = await this.adImageRepository.setMainImage(
      imageId,
      image.ad_id,
      image.post_id
    );

    if (success) {
      logger.info("Main image set", {
        image_id: imageId,
        ad_id: image.ad_id,
        post_id: image.post_id,
      });
    }

    return success;
  }
}
