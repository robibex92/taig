import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  getFaqsSchema,
  updateFaqSchema,
  faqIdSchema,
} from "../../core/validation/schemas/faq.schema.js";

/**
 * FAQ Controller
 * Handles HTTP requests for FAQ operations
 */
export class FaqController {
  constructor(getFaqsUseCase, updateFaqUseCase, deleteFaqUseCase) {
    this.getFaqsUseCase = getFaqsUseCase;
    this.updateFaqUseCase = updateFaqUseCase;
    this.deleteFaqUseCase = deleteFaqUseCase;
  }

  /**
   * GET /api-v1/faqs
   * Get all FAQs with optional status filter
   */
  getAll = asyncHandler(async (req, res) => {
    const { error } = getFaqsSchema.validate(req.query);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { status } = req.query;
    const faqs = await this.getFaqsUseCase.execute(status);

    res.json({
      success: true,
      data: faqs,
    });
  });

  /**
   * PATCH /api-v1/faqs/:id
   * Update FAQ
   */
  update = asyncHandler(async (req, res) => {
    const { error: idError } = faqIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (idError) {
      throw new ValidationError(idError.details[0].message);
    }

    const { error: bodyError } = updateFaqSchema.validate(req.body);

    if (bodyError) {
      throw new ValidationError(bodyError.details[0].message);
    }

    const updatedFaq = await this.updateFaqUseCase.execute(
      parseInt(req.params.id),
      req.body
    );

    res.json({
      success: true,
      data: updatedFaq,
    });
  });

  /**
   * DELETE /api-v1/faqs/:id
   * Soft delete FAQ
   */
  delete = asyncHandler(async (req, res) => {
    const { error } = faqIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const deletedFaq = await this.deleteFaqUseCase.execute(
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      message: "FAQ marked as deleted",
      data: deletedFaq,
    });
  });
}
