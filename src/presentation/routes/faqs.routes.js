import express from "express";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();
const faqController = container.resolve("faqController");

/**
 * @route   GET /faqs
 * @desc    Get all FAQs with optional status filter
 * @access  Public
 */
router.get("/faqs", faqController.getAll);

/**
 * @route   PATCH /faqs/:id
 * @desc    Update FAQ
 * @access  Private (add auth middleware if needed)
 */
router.patch("/faqs/:id", faqController.update);

/**
 * @route   DELETE /faqs/:id
 * @desc    Soft delete FAQ
 * @access  Private (add auth middleware if needed)
 */
router.delete("/faqs/:id", faqController.delete);

export default router;
