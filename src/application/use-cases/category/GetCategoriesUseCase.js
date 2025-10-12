/**
 * Use case for getting all categories
 */
export class GetCategoriesUseCase {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async execute() {
    return await this.categoryRepository.findAll();
  }
}
