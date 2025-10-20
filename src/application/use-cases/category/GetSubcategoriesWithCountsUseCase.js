import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository.js";

/**
 * Get Subcategories with Ad Counts Use Case
 * Returns subcategories with the count of active ads in each subcategory
 */
export class GetSubcategoriesWithCountsUseCase {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async execute(categoryId) {
    try {
      const subcategoriesWithCounts =
        await this.categoryRepository.getSubcategoriesWithAdCounts(categoryId);
      return subcategoriesWithCounts;
    } catch (error) {
      console.error("Error getting subcategories with counts:", error);
      throw error;
    }
  }
}
