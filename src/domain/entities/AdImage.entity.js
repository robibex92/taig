/**
 * AdImage Entity
 * Represents an image associated with an ad or post
 */
export class AdImage {
  constructor({ id, ad_id, post_id, image_url, is_main, created_at }) {
    this.id = id;
    this.ad_id = ad_id;
    this.post_id = post_id;
    this.image_url = image_url;
    this.is_main = is_main;
    this.created_at = created_at;
  }

  /**
   * Create AdImage from database row
   */
  static fromDatabase(row) {
    if (!row) return null;
    return new AdImage({
      id: row.id,
      ad_id: row.ad_id,
      post_id: row.post_id,
      image_url: row.image_url,
      is_main: row.is_main,
      created_at: row.created_at,
    });
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      ad_id: this.ad_id,
      post_id: this.post_id,
      image_url: this.image_url,
      is_main: this.is_main,
      created_at: this.created_at,
    };
  }
}
