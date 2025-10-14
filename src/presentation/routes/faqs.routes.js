import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();
const faqController = container.resolve("faqController");

/**
 * @route   GET /faqs
 * @desc    Get all FAQs with optional status filter
 * @access  Public
 */
router.get("/faqs", faqController.getAll);

/**
 * @route   POST /faqs
 * @desc    Create new FAQ
 * @access  Private (Admin only)
 */
router.post("/faqs", authenticateJWT, faqController.create);

/**
 * @route   PATCH /faqs/:id
 * @desc    Update FAQ
 * @access  Private (Admin only)
 */
router.patch("/faqs/:id", authenticateJWT, faqController.update);

/**
 * @route   DELETE /faqs/:id
 * @desc    Soft delete FAQ
 * @access  Private (Admin only)
 */
router.delete("/faqs/:id", authenticateJWT, faqController.delete);

export default router;
