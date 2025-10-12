import express from "express";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();
const faqController = container.resolve("faqController");

/**
 * @route   GET /api/v1/faqs
 * @desc    Get all FAQs with optional status filter
 * @access  Public
 */
router.get("/api/v1/faqs", faqController.getAll);

/**
 * @route   PATCH /api/v1/faqs/:id
 * @desc    Update FAQ
 * @access  Private (add auth middleware if needed)
 */
router.patch("/api/v1/faqs/:id", faqController.update);

/**
 * @route   DELETE /api/v1/faqs/:id
 * @desc    Soft delete FAQ
 * @access  Private (add auth middleware if needed)
 */
router.delete("/api/v1/faqs/:id", faqController.delete);

export default router;
