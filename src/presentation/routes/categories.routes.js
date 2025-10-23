import express from "express";
import { container } from "../../infrastructure/container/Container.js";

const router = express.Router();
const categoryController = container.resolve("categoryController");

/**
 * @route   GET /categories
 * @desc    Get all categories
 * @access  Public
 */
router.get("/categories", categoryController.getAll);

/**
 * @route   GET /categories/with-counts
 * @desc    Get all categories with ad counts
 * @access  Public
 */
router.get(
  "/categories/with-counts",
  categoryController.getCategoriesWithCounts
);

/**
 * @route   GET /categories/:id
 * @desc    Get category by ID
 * @access  Public
 */
router.get("/categories/:id", categoryController.getById);

/**
 * @route   GET /categories/:category_id/subcategories
 * @desc    Get subcategories for a category
 * @access  Public
 */
router.get(
  "/categories/:category_id/subcategories",
  categoryController.getSubcategories
);

/**
 * @route   GET /subcategories
 * @desc    Get all subcategories
 * @access  Public
 */
router.get("/subcategories", categoryController.getAllSubcategories);

/**
 * @route   GET /categories/:category_id/subcategories/:subcategory_id
 * @desc    Get specific subcategory
 * @access  Public
 */
router.get(
  "/categories/:category_id/subcategories/:subcategory_id",
  categoryController.getSubcategoryById
);

/**
 * @route   GET /categories/:category_id/subcategories/with-counts
 * @desc    Get subcategories with ad counts for a category
 * @access  Public
 */
router.get(
  "/categories/:category_id/subcategories/with-counts",
  categoryController.getSubcategoriesWithCounts
);

export default router;
