import express from "express";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();
const categoryController = container.resolve("categoryController");

/**
 * @route   GET /api-v1/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get("/api-v1/categories", categoryController.getAll);

/**
 * @route   GET /api-v1/categories/:id
 * @desc    Get category by ID
 * @access  Public
 */
router.get("/api-v1/categories/:id", categoryController.getById);

/**
 * @route   GET /api-v1/categories/:category_id/subcategories
 * @desc    Get subcategories for a category
 * @access  Public
 */
router.get(
  "/api-v1/categories/:category_id/subcategories",
  categoryController.getSubcategories
);

/**
 * @route   GET /api-v1/subcategories
 * @desc    Get all subcategories
 * @access  Public
 */
router.get("/api-v1/subcategories", categoryController.getAllSubcategories);

/**
 * @route   GET /api-v1/categories/:category_id/subcategories/:subcategory_id
 * @desc    Get specific subcategory
 * @access  Public
 */
router.get(
  "/api-v1/categories/:category_id/subcategories/:subcategory_id",
  categoryController.getSubcategoryById
);

export default router;
