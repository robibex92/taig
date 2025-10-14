import {
  NotFoundError,
  ForbiddenError,
} from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Use case for soft deleting a FAQ
 * Only admins can delete FAQs
 */
export class DeleteFaqUseCase {
  constructor(faqRepository) {
    this.faqRepository = faqRepository;
  }

  async execute(faqId, user) {
    // Validate user is admin
    if (!user || user.status !== "admin") {
      logger.warn("Non-admin user attempted to delete FAQ", {
        userId: user?.user_id,
        faqId,
      });
      throw new ForbiddenError("Only administrators can delete FAQs");
    }

    // Check if FAQ exists
    const existingFaq = await this.faqRepository.findById(faqId);
    if (!existingFaq) {
      throw new NotFoundError("FAQ not found");
    }

    // Soft delete FAQ
    const deletedFaq = await this.faqRepository.softDelete(faqId);

    logger.info("FAQ deleted", {
      faqId,
      userId: user.user_id,
    });

    return deletedFaq;
  }
}
