import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  getFaqsSchema,
  createFaqSchema,
  updateFaqSchema,
  faqIdSchema,
} from "../../core/validation/schemas/faq.schema.js";

/**
 * FAQ Controller
 * Handles HTTP requests for FAQ operations
 */
export class FaqController {
  constructor(
    getFaqsUseCase,
    createFaqUseCase,
    updateFaqUseCase,
    deleteFaqUseCase
  ) {
    this.getFaqsUseCase = getFaqsUseCase;
    this.createFaqUseCase = createFaqUseCase;
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
   * POST /api-v1/faqs
   * Create new FAQ (admin only)
   */
  create = asyncHandler(async (req, res) => {
    const { error } = createFaqSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const newFaq = await this.createFaqUseCase.execute(req.body, req.user);

    res.status(201).json({
      success: true,
      data: newFaq,
      message: "FAQ created successfully",
    });
  });

  /**
   * PATCH /api-v1/faqs/:id
   * Update FAQ (admin only)
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
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: updatedFaq,
      message: "FAQ updated successfully",
    });
  });

  /**
   * DELETE /api-v1/faqs/:id
   * Soft delete FAQ (admin only)
   */
  delete = asyncHandler(async (req, res) => {
    const { error } = faqIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const deletedFaq = await this.deleteFaqUseCase.execute(
      parseInt(req.params.id),
      req.user
    );

    res.json({
      success: true,
      message: "FAQ deleted successfully",
      data: deletedFaq,
    });
  });
}
