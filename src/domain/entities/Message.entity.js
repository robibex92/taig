/**
 * Message Entity - represents a message between users
 */
export class MessageEntity {
  constructor(data) {
    this.id = data.id;
    this.sender_id = data.sender_id;
    this.receiver_id = data.receiver_id;
    this.ad_id = data.ad_id || null;
    this.parent_id = data.parent_id || null;
    this.thread_id = data.thread_id || null;
    this.content = data.content;
    this.is_read = data.is_read || false;
    this.is_deleted = data.is_deleted || false;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.read_at = data.read_at || null;

    // Related entities (опционально)
    this.sender = data.sender || null;
    this.receiver = data.receiver || null;
    this.ad = data.ad || null;
    this.parent = data.parent || null;
    this.replies = data.replies || [];
  }

  /**
   * Mark message as read
   */
  markAsRead() {
    this.is_read = true;
    this.read_at = new Date();
  }

  /**
   * Mark message as deleted (soft delete)
   */
  markAsDeleted() {
    this.is_deleted = true;
  }

  /**
   * Check if message is from sender
   */
  isFromSender(userId) {
    return this.sender_id === userId;
  }

  /**
   * Check if message is a reply
   */
  isReply() {
    return this.parent_id !== null;
  }

  /**
   * Check if message has replies
   */
  hasReplies() {
    return this.replies && this.replies.length > 0;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id?.toString(),
      sender_id: this.sender_id?.toString(),
      receiver_id: this.receiver_id?.toString(),
      ad_id: this.ad_id?.toString(),
      parent_id: this.parent_id?.toString(),
      thread_id: this.thread_id?.toString(),
      content: this.content,
      is_read: this.is_read,
      is_deleted: this.is_deleted,
      created_at: this.created_at,
      updated_at: this.updated_at,
      read_at: this.read_at,
      sender: this.sender,
      receiver: this.receiver,
      ad: this.ad,
      replies: this.replies?.map((r) => (r.toJSON ? r.toJSON() : r)),
    };
  }

  /**
   * Create from database
   */
  static fromDatabase(data) {
    return new MessageEntity(data);
  }
}
