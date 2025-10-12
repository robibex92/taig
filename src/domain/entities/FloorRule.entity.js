/**
 * FloorRule Entity
 * Represents a floor rule configuration for apartment buildings
 */
export class FloorRule {
  constructor({ id, house, entrance, floor, position }) {
    this.id = id;
    this.house = house;
    this.entrance = entrance;
    this.floor = floor;
    this.position = position;
  }

  /**
   * Create FloorRule from database row
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new FloorRule({
      id: row.id,
      house: row.house,
      entrance: row.entrance,
      floor: row.floor,
      position: row.position,
    });
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      house: this.house,
      entrance: this.entrance,
      floor: this.floor,
      position: this.position,
    };
  }
}
