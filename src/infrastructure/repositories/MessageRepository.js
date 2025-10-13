import { PrismaClient } from "@prisma/client";
import { MessageEntity } from "../../domain/entities/Message.entity.js";
import { DatabaseError } from "../../domain/errors/index.js";
import logger from "../../infrastructure/logger/index.js";

const prisma = new PrismaClient();

/**
 * MessageRepository - handles all database operations for messages
 */
export class MessageRepository {
  /**
   * Create a new message
   */
  async create(messageData) {
    try {
      const message = await prisma.message.create({
        data: {
          sender_id: BigInt(messageData.sender_id),
          receiver_id: BigInt(messageData.receiver_id),
          ad_id: messageData.ad_id ? BigInt(messageData.ad_id) : null,
          parent_id: messageData.parent_id
            ? BigInt(messageData.parent_id)
            : null,
          thread_id: messageData.thread_id
            ? BigInt(messageData.thread_id)
            : null,
          content: messageData.content,
          is_read: messageData.is_read || false,
        },
        include: {
          sender: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          receiver: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
      });

      return MessageEntity.fromDatabase(message);
    } catch (error) {
      logger.error("Error creating message", { error: error.message });
      throw new DatabaseError("Failed to create message", error);
    }
  }

  /**
   * Find message by ID
   */
  async findById(messageId) {
    try {
      const message = await prisma.message.findUnique({
        where: { id: BigInt(messageId) },
        include: {
          sender: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          receiver: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          replies: {
            where: { is_deleted: false },
            orderBy: { created_at: "asc" },
          },
        },
      });

      return message ? MessageEntity.fromDatabase(message) : null;
    } catch (error) {
      logger.error("Error finding message by ID", {
        error: error.message,
        messageId,
      });
      throw new DatabaseError("Failed to find message", error);
    }
  }

  /**
   * Get messages between two users for a specific ad
   */
  async getConversationMessages(
    user1Id,
    user2Id,
    adId = null,
    limit = 50,
    offset = 0
  ) {
    try {
      const where = {
        is_deleted: false,
        OR: [
          {
            sender_id: BigInt(user1Id),
            receiver_id: BigInt(user2Id),
          },
          {
            sender_id: BigInt(user2Id),
            receiver_id: BigInt(user1Id),
          },
        ],
      };

      if (adId) {
        where.ad_id = BigInt(adId);
      }

      const messages = await prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          receiver: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          replies: {
            where: { is_deleted: false },
            orderBy: { created_at: "asc" },
            take: 5, // Limit replies to avoid deep nesting
          },
        },
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
      });

      return messages.map((msg) => MessageEntity.fromDatabase(msg));
    } catch (error) {
      logger.error("Error getting conversation messages", {
        error: error.message,
        user1Id,
        user2Id,
        adId,
      });
      throw new DatabaseError("Failed to get conversation messages", error);
    }
  }

  /**
   * Get messages by ad ID (all messages related to an ad)
   */
  async getMessagesByAd(adId, limit = 50, offset = 0) {
    try {
      const messages = await prisma.message.findMany({
        where: {
          ad_id: BigInt(adId),
          is_deleted: false,
        },
        include: {
          sender: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          receiver: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
      });

      return messages.map((msg) => MessageEntity.fromDatabase(msg));
    } catch (error) {
      logger.error("Error getting messages by ad", {
        error: error.message,
        adId,
      });
      throw new DatabaseError("Failed to get messages by ad", error);
    }
  }

  /**
   * Get user's messages (sent or received)
   */
  async getUserMessages(userId, type = "all", limit = 50, offset = 0) {
    try {
      const where = {
        is_deleted: false,
      };

      if (type === "sent") {
        where.sender_id = BigInt(userId);
      } else if (type === "received") {
        where.receiver_id = BigInt(userId);
      } else {
        where.OR = [
          { sender_id: BigInt(userId) },
          { receiver_id: BigInt(userId) },
        ];
      }

      const messages = await prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          receiver: {
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
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
      });

      return messages.map((msg) => MessageEntity.fromDatabase(msg));
    } catch (error) {
      logger.error("Error getting user messages", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to get user messages", error);
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId) {
    try {
      const message = await prisma.message.update({
        where: { id: BigInt(messageId) },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      return MessageEntity.fromDatabase(message);
    } catch (error) {
      logger.error("Error marking message as read", {
        error: error.message,
        messageId,
      });
      throw new DatabaseError("Failed to mark message as read", error);
    }
  }

  /**
   * Mark all messages as read
   */
  async markAllAsRead(userId, senderId) {
    try {
      const result = await prisma.message.updateMany({
        where: {
          receiver_id: BigInt(userId),
          sender_id: BigInt(senderId),
          is_read: false,
        },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      return result.count;
    } catch (error) {
      logger.error("Error marking all messages as read", {
        error: error.message,
        userId,
        senderId,
      });
      throw new DatabaseError("Failed to mark all messages as read", error);
    }
  }

  /**
   * Soft delete message
   */
  async softDelete(messageId) {
    try {
      const message = await prisma.message.update({
        where: { id: BigInt(messageId) },
        data: { is_deleted: true },
      });

      return MessageEntity.fromDatabase(message);
    } catch (error) {
      logger.error("Error soft deleting message", {
        error: error.message,
        messageId,
      });
      throw new DatabaseError("Failed to delete message", error);
    }
  }

  /**
   * Get unread messages count for user
   */
  async getUnreadCount(userId) {
    try {
      const count = await prisma.message.count({
        where: {
          receiver_id: BigInt(userId),
          is_read: false,
          is_deleted: false,
        },
      });

      return count;
    } catch (error) {
      logger.error("Error getting unread count", {
        error: error.message,
        userId,
      });
      throw new DatabaseError("Failed to get unread count", error);
    }
  }

  /**
   * Get message thread (parent message with all replies)
   */
  async getThread(threadId) {
    try {
      const messages = await prisma.message.findMany({
        where: {
          OR: [{ id: BigInt(threadId) }, { thread_id: BigInt(threadId) }],
          is_deleted: false,
        },
        include: {
          sender: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
          receiver: {
            select: {
              user_id: true,
              first_name: true,
              username: true,
            },
          },
        },
        orderBy: { created_at: "asc" },
      });

      return messages.map((msg) => MessageEntity.fromDatabase(msg));
    } catch (error) {
      logger.error("Error getting message thread", {
        error: error.message,
        threadId,
      });
      throw new DatabaseError("Failed to get message thread", error);
    }
  }
}

export default new MessageRepository();
