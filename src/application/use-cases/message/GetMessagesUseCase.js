import MessageRepository from "../../../infrastructure/repositories/MessageRepository.js";
import ConversationRepository from "../../../infrastructure/repositories/ConversationRepository.js";
import {
  ValidationError,
  ForbiddenError,
} from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * GetMessagesUseCase - retrieves messages for a conversation
 */
export class GetMessagesUseCase {
  constructor(
    messageRepository = MessageRepository,
    conversationRepository = ConversationRepository
  ) {
    this.messageRepository = messageRepository;
    this.conversationRepository = conversationRepository;
  }

  async execute({
    currentUserId,
    otherUserId,
    adId = null,
    limit = 50,
    offset = 0,
    markAsRead = false,
  }) {
    try {
      // Validate input
      if (!currentUserId || !otherUserId) {
        throw new ValidationError("User IDs are required");
      }

      // Prevent getting messages with yourself
      if (BigInt(currentUserId) === BigInt(otherUserId)) {
        throw new ValidationError("Cannot get messages with yourself");
      }

      // Get messages
      const messages = await this.messageRepository.getConversationMessages(
        currentUserId,
        otherUserId,
        adId,
        limit,
        offset
      );

      // Mark unread messages as read if requested
      if (markAsRead && messages.length > 0) {
        await this.messageRepository.markAllAsRead(currentUserId, otherUserId);
      }

      // Get or create conversation for metadata
      const conversation = await this.conversationRepository.createOrFind(
        currentUserId,
        otherUserId,
        adId
      );

      logger.info("Messages retrieved successfully", {
        currentUserId,
        otherUserId,
        adId,
        count: messages.length,
      });

      return {
        messages,
        conversation,
        total: messages.length,
        hasMore: messages.length === limit,
      };
    } catch (error) {
      logger.error("Error in GetMessagesUseCase", { error: error.message });
      throw error;
    }
  }
}

export default new GetMessagesUseCase();
