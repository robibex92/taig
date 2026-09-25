import express from "express";
import { container } from "../../infrastructure/container/Container.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../../core/middlewares/checkRole.js";
import { GLOBAL_ROLES } from "../../core/utils/roles.js";

const router = express.Router();
const faqController = container.resolve("faqController");

/** Запись FAQ — только администрация; GET остаётся публичным. */
const staffOnly = requireRoles(GLOBAL_ROLES.ADMIN, GLOBAL_ROLES.MODERATOR);

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
router.post("/faqs", authenticateJWT, staffOnly, faqController.create);

/**
 * @route   PATCH /faqs/:id
 * @desc    Update FAQ
 * @access  Private (Admin only)
 */
router.patch("/faqs/:id", authenticateJWT, staffOnly, faqController.update);

/**
 * @route   DELETE /faqs/:id
 * @desc    Soft delete FAQ
 * @access  Private (Admin only)
 */
router.delete("/faqs/:id", authenticateJWT, staffOnly, faqController.delete);

export default router;
