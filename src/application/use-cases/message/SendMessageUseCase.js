import MessageRepository from "../../../infrastructure/repositories/MessageRepository.js";
import ConversationRepository from "../../../infrastructure/repositories/ConversationRepository.js";
import UserRepository from "../../../infrastructure/repositories/UserRepository.js";
import {
  ValidationError,
  NotFoundError,
} from "../../../domain/errors/index.js";
import logger from "../../../infrastructure/logger/index.js";

/**
 * SendMessageUseCase - handles sending messages between users
 */
export class SendMessageUseCase {
  constructor(
    messageRepository = MessageRepository,
    conversationRepository = ConversationRepository,
    userRepository = UserRepository
  ) {
    this.messageRepository = messageRepository;
    this.conversationRepository = conversationRepository;
    this.userRepository = userRepository;
  }

  async execute({
    senderId,
    receiverId,
    adId = null,
    content,
    parentId = null,
  }) {
    try {
      // Validate input
      if (!senderId || !receiverId) {
        throw new ValidationError("Sender and receiver IDs are required");
      }

      if (!content || content.trim().length === 0) {
        throw new ValidationError("Message content cannot be empty");
      }

      if (content.length > 5000) {
        throw new ValidationError(
          "Message content too long (max 5000 characters)"
        );
      }

      // Check if users exist
      const [sender, receiver] = await Promise.all([
        this.userRepository.findById(senderId),
        this.userRepository.findById(receiverId),
      ]);

      if (!sender) {
        throw new NotFoundError("Sender not found");
      }

      if (!receiver) {
        throw new NotFoundError("Receiver not found");
      }

      // Prevent self-messaging
      if (BigInt(senderId) === BigInt(receiverId)) {
        throw new ValidationError("Cannot send message to yourself");
      }

      // Create or find conversation
      const conversation = await this.conversationRepository.createOrFind(
        senderId,
        receiverId,
        adId
      );

      // Determine thread_id for threading
      let threadId = null;
      if (parentId) {
        const parentMessage = await this.messageRepository.findById(parentId);
        if (parentMessage) {
          threadId = parentMessage.thread_id || parentMessage.id;
        }
      }

      // Create message
      const message = await this.messageRepository.create({
        sender_id: senderId,
        receiver_id: receiverId,
        ad_id: adId,
        parent_id: parentId,
        thread_id: threadId,
        content: content.trim(),
        is_read: false,
      });

      // Update conversation's last message
      await this.conversationRepository.updateLastMessage(
        conversation.id,
        message.id
      );

      logger.info("Message sent successfully", {
        messageId: message.id,
        senderId,
        receiverId,
        conversationId: conversation.id,
      });

      return {
        message,
        conversation,
      };
    } catch (error) {
      logger.error("Error in SendMessageUseCase", { error: error.message });
      throw error;
    }
  }
}

export default new SendMessageUseCase();
