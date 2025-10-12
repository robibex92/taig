/**
 * Use case for getting all FAQs
 */
export class GetFaqsUseCase {
  constructor(faqRepository) {
    this.faqRepository = faqRepository;
  }

  async execute(status = null) {
    return await this.faqRepository.findAll(status);
  }
}
