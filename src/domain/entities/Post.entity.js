import { AD_STATUS } from "../../core/constants/index.js";

/**
 * Post Entity - represents a news post or announcement
 */
export class PostEntity {
  constructor(data) {
    this.id = data.id || null;
    this.title = data.title;
    this.content = data.content;
    this.image_url = data.image_url || null;
    this.status = data.status || "active";
    this.source = data.source || null;
    this.marker = data.marker || null;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || null;
    this.images = data.images || [];
  }

  /**
   * Check if post is active
   */
  isActive() {
    return this.status === "active";
  }

  /**
   * Check if post is deleted
   */
  isDeleted() {
    return this.status === "deleted";
  }

  /**
   * Mark post as deleted
   */
  markAsDeleted() {
    this.status = "deleted";
    this.updated_at = new Date();
  }

  /**
   * Update post data
   */
  update(data) {
    const allowedFields = [
      "title",
      "content",
      "image_url",
      "source",
      "marker",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        this[field] = data[field];
      }
    });

    this.updated_at = new Date();
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      image_url: this.image_url,
      status: this.status,
      source: this.source,
      marker: this.marker,
      created_at: this.created_at,
      updated_at: this.updated_at,
      images: this.images,
    };
  }
}

// Export with alias for compatibility
export { PostEntity as Post };
export default PostEntity;