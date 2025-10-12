import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * Use case for getting a category by ID
 */
export class GetCategoryByIdUseCase {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async execute(categoryId) {
    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
      throw new NotFoundError("Category");
    }

    return category;
  }
}
