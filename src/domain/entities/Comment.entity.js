/**
 * Comment Entity
 * Represents a comment/message in an ad's chat
 */
class Comment {
  constructor({
    id,
    ad_id,
    user_id,
    parent_id = null,
    content,
    is_seller = false,
    is_deleted = false,
    created_at,
    updated_at,
    // Relations
    ad = null,
    user = null,
    parent = null,
    replies = [],
  }) {
    this.id = id;
    this.ad_id = ad_id;
    this.user_id = user_id;
    this.parent_id = parent_id;
    this.content = content;
    this.is_seller = is_seller;
    this.is_deleted = is_deleted;
    this.created_at = created_at;
    this.updated_at = updated_at;
    // Relations
    this.ad = ad;
    this.user = user;
    this.parent = parent;
    this.replies = replies;
  }

  /**
   * Check if comment is a reply
   */
  isReply() {
    return this.parent_id !== null;
  }

  /**
   * Check if comment can be edited
   */
  canBeEdited(userId) {
    return this.user_id === userId && !this.is_deleted;
  }

  /**
   * Check if comment can be deleted
   */
  canBeDeleted(userId, isAdmin = false) {
    return (this.user_id === userId || isAdmin) && !this.is_deleted;
  }

  /**
   * Soft delete comment
   */
  delete() {
    this.is_deleted = true;
    this.content = "[удалено]";
  }

  /**
   * Validate comment data
   */
  static validate(data) {
    const errors = [];

    if (!data.ad_id) {
      errors.push("ad_id is required");
    }

    if (!data.user_id) {
      errors.push("user_id is required");
    }

    if (!data.content || data.content.trim().length === 0) {
      errors.push("Content is required");
    }

    if (data.content && data.content.length > 2000) {
      errors.push("Content must be less than 2000 characters");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = Comment;
