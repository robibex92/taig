import { PrismaClient } from "@prisma/client";
import { ConversationEntity } from "../../domain/entities/Conversation.entity.js";
import { DatabaseError } from "../../domain/errors/index.js";
import logger from "../../infrastructure/logger/index.js";

const prisma = new PrismaClient();

/**
 * ConversationRepository - handles all database operations for conversations
 */
export class ConversationRepository {
  /**
   * Create or find existing conversation
   */
  async createOrFind(user1Id, user2Id, adId = null) {
    try {
      // Normalize user IDs (smaller ID first)
      const [smallerId, biggerId] =
        BigInt(user1Id) < BigInt(user2Id)
          ? [BigInt(user1Id), BigInt(user2Id)]
          : [BigInt(user2Id), BigInt(user1Id)];

      // Check if conversation exists
      let conversation = await prisma.conversation.findFirst({
        where: {
          user1_id: smallerId,
          user2_id: biggerId,
          ad_id: adId ? BigInt(adId) : null,
        },
        include: {
          user1: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          user2: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          ad: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Create if doesn't exist
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            user1_id: smallerId,
            user2_id: biggerId,
            ad_id: adId ? BigInt(adId) : null,
          },
          include: {
            user1: {
              select: {
                user_id: true,
                first_name: true,
                username: true,
              },
            },
            user2: {
              select: {
                user_id: true,
                first_name: true,
                username: true,
              },
            },
            ad: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });
      }

      return ConversationEntity.fromDatabase(conversation);
    } catch (error) {
      logger.error("Error creating/finding conversation", {
        error: error.message,
        user1Id,
        user2Id,
        adId,
      });
      throw new DatabaseError("Failed to create/find conversation", error);
    }
  }

  /**
   * Find conversation by ID
   */
  async findById(conversationId) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: BigInt(conversationId) },
        include: {
          user1: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          user2: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          ad: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return conversation
        ? ConversationEntity.fromDatabase(conversation)
        : null;
    } catch (error) {
      logger.error("Error finding conversation by ID", {
        error: error.message,
        conversationId,
      });
      throw new DatabaseError("Failed to find conversation", error);
    }
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userId, limit = 20, offset = 0) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [{ user1_id: BigInt(userId) }, { user2_id: BigInt(userId) }],
        },
        include: {
          user1: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          user2: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          ad: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          last_message_at: {
            sort: "desc",
            nulls: "last",
          },
        },
        take: limit,
        skip: offset,
      });

      return conversations.map((conv) => ConversationEntity.fromDatabase(conv));
    } catch (error) {
      logger.error("Error getting user conversations", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to get user conversations", error);
    }
  }

  /**
   * Get conversations by ad ID
   */
  async getAdConversations(adId, limit = 20, offset = 0) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          ad_id: BigInt(adId),
        },
        include: {
          user1: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          user2: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          ad: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          last_message_at: {
            sort: "desc",
            nulls: "last",
          },
        },
        take: limit,
        skip: offset,
      });

      return conversations.map((conv) => ConversationEntity.fromDatabase(conv));
    } catch (error) {
      logger.error("Error getting ad conversations", {
        error: error.message,
        adId,
      });
      throw new DatabaseError("Failed to get ad conversations", error);
    }
  }

  /**
   * Update last message info
   */
  async updateLastMessage(conversationId, messageId) {
    try {
      const conversation = await prisma.conversation.update({
        where: { id: BigInt(conversationId) },
        data: {
          last_message_id: BigInt(messageId),
          last_message_at: new Date(),
        },
      });

      return ConversationEntity.fromDatabase(conversation);
    } catch (error) {
      logger.error("Error updating last message", {
        error: error.message,
        conversationId,
        messageId,
      });
      throw new DatabaseError("Failed to update last message", error);
    }
  }

  /**
   * Delete conversation
   */
  async delete(conversationId) {
    try {
      await prisma.conversation.delete({
        where: { id: BigInt(conversationId) },
      });

      return true;
    } catch (error) {
      logger.error("Error deleting conversation", {
        error: error.message,
        conversationId,
      });
      throw new DatabaseError("Failed to delete conversation", error);
    }
  }

  /**
   * Check if user is participant of conversation
   */
  async isParticipant(conversationId, userId) {
    try {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: BigInt(conversationId),
          OR: [{ user1_id: BigInt(userId) }, { user2_id: BigInt(userId) }],
        },
      });

      return !!conversation;
    } catch (error) {
      logger.error("Error checking conversation participant", {
        error: error.message,
        conversationId,
        userId,
      });
      throw new DatabaseError(
        "Failed to check conversation participant",
        error
      );
    }
  }

  /**
   * Get conversation with last message preview
   */
  async getWithLastMessage(conversationId) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: BigInt(conversationId) },
        include: {
          user1: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          user2: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          ad: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (!conversation) {
        return null;
      }

      // Get last message separately
      if (conversation.last_message_id) {
        const lastMessage = await prisma.message.findUnique({
          where: { id: conversation.last_message_id },
          include: {
            sender: {
              select: {
                user_id: true,
                first_name: true,
                username: true,
              },
            },
          },
        });

        const conversationEntity =
          ConversationEntity.fromDatabase(conversation);
        conversationEntity.last_message = lastMessage;
        return conversationEntity;
      }

      return ConversationEntity.fromDatabase(conversation);
    } catch (error) {
      logger.error("Error getting conversation with last message", {
        error: error.message,
        conversationId,
      });
      throw new DatabaseError(
        "Failed to get conversation with last message",
        error
      );
    }
  }
}

export default new ConversationRepository();
