/**
 * CarAdminNote Entity
 * Represents an admin-only note about car ownership
 */
export class CarAdminNote {
  constructor({
    id,
    car_id,
    note,
    created_by_admin_id,
    created_at,
    updated_at,
  }) {
    this.id = id;
    this.car_id = car_id;
    this.note = note;
    this.created_by_admin_id = created_by_admin_id;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  /**
   * Create CarAdminNote from database row
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new CarAdminNote({
      id: row.id,
      car_id: row.car_id,
      note: row.note,
      created_by_admin_id: row.created_by_admin_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      car_id: this.car_id,
      note: this.note,
      created_by_admin_id: this.created_by_admin_id,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
