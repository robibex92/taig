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
 * Буквальный `with-counts` — до `:subcategory_id`: express матчит маршруты в
 * порядке регистрации, и «with-counts» успевал попасть в параметр, откуда
 * прилетало «"subcategory_id" must be a number».
 */
router.get(
  "/categories/:category_id/subcategories/with-counts",
  categoryController.getSubcategoriesWithCounts
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

export default router;
