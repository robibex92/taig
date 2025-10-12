/**
 * Category Repository Interface
 * Defines the contract for category data access
 */
export class ICategoryRepository {
  /**
   * Get all categories
   * @returns {Promise<Category[]>}
   */
  async findAll() {
    throw new Error("Method 'findAll()' must be implemented");
  }

  /**
   * Find category by ID
   * @param {number} id
   * @returns {Promise<Category|null>}
   */
  async findById(id) {
    throw new Error("Method 'findById()' must be implemented");
  }

  /**
   * Get all subcategories for a category
   * @param {number} categoryId
   * @returns {Promise<Subcategory[]>}
   */
  async findSubcategoriesByCategoryId(categoryId) {
    throw new Error(
      "Method 'findSubcategoriesByCategoryId()' must be implemented"
    );
  }

  /**
   * Get all subcategories
   * @returns {Promise<Subcategory[]>}
   */
  async findAllSubcategories() {
    throw new Error("Method 'findAllSubcategories()' must be implemented");
  }

  /**
   * Find subcategory by ID and category ID
   * @param {number} subcategoryId
   * @param {number} categoryId
   * @returns {Promise<{category: Category, subcategory: Subcategory}|null>}
   */
  async findSubcategoryById(subcategoryId, categoryId) {
    throw new Error("Method 'findSubcategoryById()' must be implemented");
  }
}
