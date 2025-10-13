import ConversationRepository from "../../../infrastructure/repositories/ConversationRepository.js";
import MessageRepository from "../../../infrastructure/repositories/MessageRepository.js";
import { ValidationError } from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * GetConversationsUseCase - retrieves user's conversations
 */
export class GetConversationsUseCase {
  constructor(
    conversationRepository = ConversationRepository,
    messageRepository = MessageRepository
  ) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
  }

  async execute({ userId, limit = 20, offset = 0, includeLastMessage = true }) {
    try {
      // Validate input
      if (!userId) {
        throw new ValidationError("User ID is required");
      }

      // Get user's conversations
      const conversations =
        await this.conversationRepository.getUserConversations(
          userId,
          limit,
          offset
        );

      // Get last message preview and unread count for each conversation
      if (includeLastMessage && conversations.length > 0) {
        const conversationsWithDetails = await Promise.all(
          conversations.map(async (conversation) => {
            const conversationData = conversation.toJSON();

            // Get last message if exists
            if (conversation.last_message_id) {
              const lastMessage = await this.messageRepository.findById(
                conversation.last_message_id
              );
              conversationData.last_message = lastMessage
                ? lastMessage.toJSON()
                : null;
            }

            // Get other user ID
            const otherUserId = conversation.getOtherUserId(userId);

            // Get unread count (messages from other user to current user)
            const unreadMessages =
              await this.messageRepository.getConversationMessages(
                userId,
                otherUserId,
                conversation.ad_id,
                100,
                0
              );

            conversationData.unread_count = unreadMessages.filter(
              (msg) =>
                !msg.is_read &&
                msg.receiver_id?.toString() === userId.toString()
            ).length;

            // Add other user info
            conversationData.other_user_id = otherUserId;
            conversationData.other_user =
              conversation.user1_id?.toString() === userId.toString()
                ? conversation.user2
                : conversation.user1;

            return conversationData;
          })
        );

        logger.info("Conversations retrieved successfully", {
          userId,
          count: conversationsWithDetails.length,
        });

        return {
          conversations: conversationsWithDetails,
          total: conversationsWithDetails.length,
          hasMore: conversationsWithDetails.length === limit,
        };
      }

      logger.info("Conversations retrieved successfully", {
        userId,
        count: conversations.length,
      });

      return {
        conversations: conversations.map((c) => c.toJSON()),
        total: conversations.length,
        hasMore: conversations.length === limit,
      };
    } catch (error) {
      logger.error("Error in GetConversationsUseCase", {
        error: error.message,
      });
      throw error;
    }
  }
}

export default new GetConversationsUseCase();
