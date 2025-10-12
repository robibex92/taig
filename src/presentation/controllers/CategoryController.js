import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  getCategoryByIdSchema,
  getSubcategoriesByCategoryIdSchema,
  getSubcategoryByIdSchema,
} from "../../core/validation/schemas/category.schema.js";

/**
 * Category Controller
 * Handles HTTP requests for category operations
 */
export class CategoryController {
  constructor(
    getCategoriesUseCase,
    getCategoryByIdUseCase,
    getSubcategoriesUseCase,
    getAllSubcategoriesUseCase,
    getSubcategoryByIdUseCase
  ) {
    this.getCategoriesUseCase = getCategoriesUseCase;
    this.getCategoryByIdUseCase = getCategoryByIdUseCase;
    this.getSubcategoriesUseCase = getSubcategoriesUseCase;
    this.getAllSubcategoriesUseCase = getAllSubcategoriesUseCase;
    this.getSubcategoryByIdUseCase = getSubcategoryByIdUseCase;
  }

  /**
   * GET /api/v1/categories
   * Get all categories
   */
  getAll = asyncHandler(async (req, res) => {
    const categories = await this.getCategoriesUseCase.execute();

    res.json({
      success: true,
      data: categories,
    });
  });

  /**
   * GET /api/v1/categories/:id
   * Get category by ID
   */
  getById = asyncHandler(async (req, res) => {
    const { error } = getCategoryByIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const category = await this.getCategoryByIdUseCase.execute(
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      data: category,
    });
  });

  /**
   * GET /api/v1/categories/:category_id/subcategories
   * Get subcategories for a category
   */
  getSubcategories = asyncHandler(async (req, res) => {
    const { error } = getSubcategoriesByCategoryIdSchema.validate({
      category_id: parseInt(req.params.category_id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const subcategories = await this.getSubcategoriesUseCase.execute(
      parseInt(req.params.category_id)
    );

    res.json({
      success: true,
      subcategories,
    });
  });

  /**
   * GET /api/v1/subcategories
   * Get all subcategories
   */
  getAllSubcategories = asyncHandler(async (req, res) => {
    const subcategories = await this.getAllSubcategoriesUseCase.execute();

    res.json({
      success: true,
      data: subcategories,
    });
  });

  /**
   * GET /api/v1/categories/:category_id/subcategories/:subcategory_id
   * Get specific subcategory
   */
  getSubcategoryById = asyncHandler(async (req, res) => {
    const { error } = getSubcategoryByIdSchema.validate({
      category_id: parseInt(req.params.category_id),
      subcategory_id: parseInt(req.params.subcategory_id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const result = await this.getSubcategoryByIdUseCase.execute(
      parseInt(req.params.subcategory_id),
      parseInt(req.params.category_id)
    );

    res.json({
      success: true,
      category: result.category,
      subcategory: result.subcategory,
    });
  });
}
