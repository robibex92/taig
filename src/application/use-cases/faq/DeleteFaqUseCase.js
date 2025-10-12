import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for soft deleting a FAQ
 */
export class DeleteFaqUseCase {
  constructor(faqRepository) {
    this.faqRepository = faqRepository;
  }

  async execute(faqId) {
    // Check if FAQ exists
    const existingFaq = await this.faqRepository.findById(faqId);
    if (!existingFaq) {
      throw new NotFoundError("FAQ");
    }

    // Soft delete FAQ
    const deletedFaq = await this.faqRepository.softDelete(faqId);

    logger.info("FAQ soft deleted", { faq_id: faqId });

    return deletedFaq;
  }
}
