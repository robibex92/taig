/**
 * Use case for getting images by ID (tries ad_id first, then post_id)
 */
export class GetImagesByIdUseCase {
  constructor(adImageRepository) {
    this.adImageRepository = adImageRepository;
  }

  async execute(id) {
    // Try as ad_id first
    let images = await this.adImageRepository.findByAdId(id);

    // If no results, try as post_id
    if (images.length === 0) {
      images = await this.adImageRepository.findByPostId(id);
    }

    return images;
  }
}
