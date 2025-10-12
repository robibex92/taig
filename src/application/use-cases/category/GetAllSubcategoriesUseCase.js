/**
 * Use case for getting all subcategories
 */
export class GetAllSubcategoriesUseCase {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async execute() {
    return await this.categoryRepository.findAllSubcategories();
  }
}
