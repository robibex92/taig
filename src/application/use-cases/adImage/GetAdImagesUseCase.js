/**
 * Use case for getting ad images
 */
export class GetAdImagesUseCase {
  constructor(adImageRepository) {
    this.adImageRepository = adImageRepository;
  }

  async execute(adId, postId) {
    if (adId) {
      return await this.adImageRepository.findByAdId(adId);
    } else if (postId) {
      return await this.adImageRepository.findByPostId(postId);
    }
    return [];
  }
}
