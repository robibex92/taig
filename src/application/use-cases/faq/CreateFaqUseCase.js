import {
  ForbiddenError,
  ValidationError,
} from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * CreateFaqUseCase
 * Creates a new FAQ entry
 * Only admins can create FAQs
 */
export class CreateFaqUseCase {
  constructor(faqRepository) {
    this.faqRepository = faqRepository;
  }

  /**
   * Execute use case
   * @param {object} faqData - FAQ data (question, answer, status)
   * @param {object} user - Current user
   * @returns {Promise<object>} Created FAQ
   */
  async execute(faqData, user) {
    // Validate user is admin
    if (!user || user.status !== "admin") {
      logger.warn("Non-admin user attempted to create FAQ", {
        userId: user?.user_id,
      });
      throw new ForbiddenError("Only administrators can create FAQs");
    }

    // Validate FAQ data
    if (!faqData.question || !faqData.answer) {
      throw new ValidationError("Question and answer are required");
    }

    // Trim inputs
    const trimmedData = {
      question: faqData.question.trim(),
      answer: faqData.answer.trim(),
      status: faqData.status || "active",
    };

    // Create FAQ
    const newFaq = await this.faqRepository.create(trimmedData);

    logger.info("FAQ created", {
      faqId: newFaq.id,
      userId: user.user_id,
    });

    return newFaq;
  }
}

export default CreateFaqUseCase;

