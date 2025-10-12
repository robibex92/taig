import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * Use case for updating a FAQ
 */
export class UpdateFaqUseCase {
  constructor(faqRepository) {
    this.faqRepository = faqRepository;
  }

  async execute(faqId, updateData) {
    // Check if FAQ exists
    const existingFaq = await this.faqRepository.findById(faqId);
    if (!existingFaq) {
      throw new NotFoundError("FAQ");
    }

    // Update FAQ
    const updatedFaq = await this.faqRepository.update(faqId, updateData);

    return updatedFaq;
  }
}
