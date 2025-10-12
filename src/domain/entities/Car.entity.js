/**
 * Car Entity
 * Represents a car registered in the system
 */
export class Car {
  constructor({
    id,
    user_id,
    car_number,
    car_model,
    car_brand,
    car_color,
    info,
    created_at,
    status,
  }) {
    this.id = id;
    this.user_id = user_id;
    this.car_number = car_number;
    this.car_model = car_model;
    this.car_brand = car_brand;
    this.car_color = car_color;
    this.info = info;
    this.created_at = created_at;
    this.status = status;
  }

  /**
   * Create Car from database row
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new Car({
      id: row.id,
      user_id: row.user_id,
      car_number: row.car_number,
      car_model: row.car_model,
      car_brand: row.car_brand,
      car_color: row.car_color,
      info: row.info,
      created_at: row.created_at,
      status: row.status,
    });
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      car_number: this.car_number,
      car_model: this.car_model,
      car_brand: this.car_brand,
      car_color: this.car_color,
      info: this.info,
      created_at: this.created_at,
      status: this.status,
    };
  }
}
