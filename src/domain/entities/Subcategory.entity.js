/**
 * Subcategory Entity
 * Represents a subcategory in the system
 */
export class Subcategory {
  constructor({ id, category_id, name }) {
    this.id = id;
    this.category_id = category_id;
    this.name = name;
  }

  /**
   * Create Subcategory from database row
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new Subcategory({
      id: row.id,
      category_id: row.category_id,
      name: row.name,
    });
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      category_id: this.category_id,
      name: this.name,
    };
  }
}
