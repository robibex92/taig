import {
  NotFoundError,
  ForbiddenError,
} from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * Use case for updating a FAQ
 * Only admins can update FAQs
 */
export class UpdateFaqUseCase {
  constructor(faqRepository) {
    this.faqRepository = faqRepository;
  }

  async execute(faqId, updateData, user) {
    // Validate user is admin
    if (!user || user.status !== "admin") {
      logger.warn("Non-admin user attempted to update FAQ", {
        userId: user?.user_id,
        faqId,
      });
      throw new ForbiddenError("Only administrators can update FAQs");
    }

    // Check if FAQ exists
    const existingFaq = await this.faqRepository.findById(faqId);
    if (!existingFaq) {
      throw new NotFoundError("FAQ not found");
    }

    // Update FAQ
    const updatedFaq = await this.faqRepository.update(faqId, updateData);

    logger.info("FAQ updated", {
      faqId,
      userId: user.user_id,
    });

    return updatedFaq;
  }
}
