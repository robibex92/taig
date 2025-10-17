/**
 * CarImage Entity
 * Represents a photo in a car's gallery
 */
export class CarImage {
  constructor({
    id,
    car_id,
    image_url,
    comment,
    added_by_user_id,
    created_at,
    updated_at,
  }) {
    this.id = id;
    this.car_id = car_id;
    this.image_url = image_url;
    this.comment = comment;
    this.added_by_user_id = added_by_user_id;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  /**
   * Create CarImage from database row
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new CarImage({
      id: row.id,
      car_id: row.car_id,
      image_url: row.image_url,
      comment: row.comment,
      added_by_user_id: row.added_by_user_id,
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
      image_url: this.image_url,
      comment: this.comment,
      added_by_user_id: this.added_by_user_id,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * Convert to JSON with admin-only fields hidden for non-admin users
   */
  toJSONForUser(isAdmin = false) {
    const json = this.toJSON();
    if (!isAdmin) {
      // Hide comment from non-admin users
      delete json.comment;
    }
    return json;
  }
}
