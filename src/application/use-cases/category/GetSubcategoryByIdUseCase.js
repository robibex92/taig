import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * Use case for getting a specific subcategory
 */
export class GetSubcategoryByIdUseCase {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async execute(subcategoryId, categoryId) {
    const result = await this.categoryRepository.findSubcategoryById(
      subcategoryId,
      categoryId
    );

    if (!result) {
      throw new NotFoundError("Subcategory");
    }

    return result;
  }
}
