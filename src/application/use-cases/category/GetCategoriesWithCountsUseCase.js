import { ICategoryRepository } from "../../../domain/repositories/ICategoryRepository.js";

/**
 * Get Categories with Ad Counts Use Case
 * Returns categories with the count of active ads in each category
 */
export class GetCategoriesWithCountsUseCase {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async execute() {
    try {
      const categoriesWithCounts =
        await this.categoryRepository.getCategoriesWithAdCounts();
      return categoriesWithCounts;
    } catch (error) {
      console.error("Error getting categories with counts:", error);
      throw error;
    }
  }
}
