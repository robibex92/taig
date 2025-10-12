import { AD_STATUS } from "../../core/constants/index.js";

/**
 * Ad Entity - represents a classified advertisement
 */
export class AdEntity {
  constructor(data) {
    this.id = data.id || null;
    this.user_id = data.user_id;
    this.title = data.title;
    this.content = data.content;
    this.category = data.category;
    this.subcategory = data.subcategory || null;
    this.price = data.price || null;
    this.status = data.status || AD_STATUS.ACTIVE;
    this.view_count = data.view_count || 0;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.images = data.images || [];
  }

  /**
   * Check if ad belongs to user
   */
  belongsToUser(userId) {
    return this.user_id === userId;
  }

  /**
   * Check if ad is active
   */
  isActive() {
    return this.status === AD_STATUS.ACTIVE;
  }

  /**
   * Check if ad is archived
   */
  isArchived() {
    return this.status === AD_STATUS.ARCHIVE;
  }

  /**
   * Archive the ad
   */
  archive() {
    this.status = AD_STATUS.ARCHIVE;
    this.updated_at = new Date();
  }

  /**
   * Increment view count
   */
  incrementViewCount() {
    this.view_count += 1;
  }

  /**
   * Update ad data
   */
  update(data) {
    const allowedFields = [
      "title",
      "content",
      "category",
      "subcategory",
      "price",
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
      user_id: this.user_id,
      title: this.title,
      content: this.content,
      category: this.category,
      subcategory: this.subcategory,
      price: this.price,
      status: this.status,
      view_count: this.view_count,
      created_at: this.created_at,
      updated_at: this.updated_at,
      images: this.images,
    };
  }
}
