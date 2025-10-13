/**
 * Conversation Entity - represents a conversation between two users
 */
export class ConversationEntity {
  constructor(data) {
    this.id = data.id;
    this.user1_id = data.user1_id;
    this.user2_id = data.user2_id;
    this.ad_id = data.ad_id || null;
    this.last_message_id = data.last_message_id || null;
    this.last_message_at = data.last_message_at || null;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();

    // Related entities (опционально)
    this.user1 = data.user1 || null;
    this.user2 = data.user2 || null;
    this.ad = data.ad || null;
    this.last_message = data.last_message || null;
  }

  /**
   * Update last message info
   */
  updateLastMessage(messageId) {
    this.last_message_id = messageId;
    this.last_message_at = new Date();
    this.updated_at = new Date();
  }

  /**
   * Get other user ID
   */
  getOtherUserId(currentUserId) {
    return this.user1_id === currentUserId ? this.user2_id : this.user1_id;
  }

  /**
   * Check if user is participant
   */
  isParticipant(userId) {
    return this.user1_id === userId || this.user2_id === userId;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id?.toString(),
      user1_id: this.user1_id?.toString(),
      user2_id: this.user2_id?.toString(),
      ad_id: this.ad_id?.toString(),
      last_message_id: this.last_message_id?.toString(),
      last_message_at: this.last_message_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
      user1: this.user1,
      user2: this.user2,
      ad: this.ad,
      last_message: this.last_message,
    };
  }

  /**
   * Create from database
   */
  static fromDatabase(data) {
    return new ConversationEntity(data);
  }
}
