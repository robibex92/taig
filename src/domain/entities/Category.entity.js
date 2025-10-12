/**
 * Category Entity
 * Represents a category in the system
 */
export class Category {
  constructor({ id, name, image }) {
    this.id = id;
    this.name = name;
    this.image = image;
  }

  /**
   * Create Category from database row
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new Category({
      id: row.id,
      name: row.name,
      image: row.image,
    });
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      image: this.image,
    };
  }
}
