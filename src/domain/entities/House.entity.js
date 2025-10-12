/**
 * House Entity
 * Represents an apartment/flat in a building
 */
export class House {
  constructor({
    id,
    house,
    entrance,
    number,
    floor,
    facade_color,
    info,
    position,
    status,
    created_at,
    id_telegram,
  }) {
    this.id = id;
    this.house = house;
    this.entrance = entrance;
    this.number = number;
    this.floor = floor;
    this.facade_color = facade_color;
    this.info = info;
    this.position = position;
    this.status = status;
    this.created_at = created_at;
    this.id_telegram = id_telegram;
  }

  /**
   * Create entity from database row
   */
  static fromDatabase(row) {
    return new House({
      id: row.id ? Number(row.id) : null,
      house: row.house,
      entrance: row.entrance,
      number: row.number,
      floor: row.floor,
      facade_color: row.facade_color,
      info: row.info,
      position: row.position,
      status: row.status,
      created_at: row.created_at,
      id_telegram: row.id_telegram,
    });
  }

  /**
   * Convert to plain object (for API response)
   */
  toJSON() {
    return {
      id: this.id,
      house: this.house,
      entrance: this.entrance,
      number: this.number,
      floor: this.floor,
      facade_color: this.facade_color,
      info: this.info,
      position: this.position,
      status: this.status,
      created_at: this.created_at,
      id_telegram: this.id_telegram,
    };
  }

  /**
   * Convert to filtered JSON (exclude internal fields, add hasInfo)
   */
  toFilteredJSON() {
    return {
      id: this.id,
      number: this.number,
      floor: this.floor,
      facade_color: this.facade_color,
      position: this.position,
      id_telegram: this.id_telegram,
      hasInfo: !!(this.info && this.info.trim()),
    };
  }
}
