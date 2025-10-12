import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * Use case for getting subcategories for a category
 */
export class GetSubcategoriesUseCase {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async execute(categoryId) {
    // Check if category exists
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundError("Category");
    }

    const subcategories =
      await this.categoryRepository.findSubcategoriesByCategoryId(categoryId);

    return subcategories;
  }
}
