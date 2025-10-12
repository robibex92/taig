/**
 * Use case for getting ads with filters and pagination
 */
export class GetAdsUseCase {
  constructor(adRepository) {
    this.adRepository = adRepository;
  }

  async execute(filters = {}, pagination = {}) {
    const result = await this.adRepository.findAll(filters, pagination);
    return result;
  }
}
