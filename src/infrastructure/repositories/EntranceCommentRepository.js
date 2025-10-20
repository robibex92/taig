import { prisma } from "../database/db.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Entrance Comment Repository Implementation
 */
export class EntranceCommentRepository {
  /**
   * Create a new entrance comment
   */
  async create(commentData) {
    try {
      const comment = await prisma.entranceComment.create({
        data: {
          house_id: commentData.house_id,
          entrance: commentData.entrance,
          author_id: commentData.author_id,
          comment: commentData.comment,
        },
        include: {
          author: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          house: {
            select: {
              id: true,
              house: true,
            },
          },
        },
      });

      logger.info("Entrance comment created", {
        commentId: comment.id,
        houseId: comment.house_id,
        entrance: comment.entrance,
        authorId: comment.author_id,
      });

      return comment;
    } catch (error) {
      logger.error("Error creating entrance comment:", error);
      throw error;
    }
  }

  /**
   * Get comment by ID
   */
  async findById(id) {
    try {
      const comment = await prisma.entranceComment.findUnique({
        where: { id: BigInt(id) },
        include: {
          author: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          house: {
            select: {
              id: true,
              house: true,
            },
          },
        },
      });

      return comment;
    } catch (error) {
      logger.error("Error finding entrance comment by ID:", error);
      throw error;
    }
  }

  /**
   * Get comment for a specific house entrance
   */
  async findByHouseAndEntrance(house_id, entrance) {
    try {
      const comment = await prisma.entranceComment.findUnique({
        where: {
          house_id_entrance: {
            house_id: BigInt(house_id),
            entrance: entrance,
          },
        },
        include: {
          author: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          house: {
            select: {
              id: true,
              house: true,
            },
          },
        },
      });

      return comment;
    } catch (error) {
      logger.error(
        "Error finding entrance comment by house and entrance:",
        error
      );
      throw error;
    }
  }

  /**
   * Get all comments for a house
   */
  async findByHouseId(house_id) {
    try {
      const comments = await prisma.entranceComment.findMany({
        where: { house_id: BigInt(house_id) },
        include: {
          author: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          house: {
            select: {
              id: true,
              house: true,
            },
          },
        },
        orderBy: { entrance: "asc" },
      });

      return comments;
    } catch (error) {
      logger.error("Error finding entrance comments by house ID:", error);
      throw error;
    }
  }

  /**
   * Update a comment
   */
  async update(id, updateData) {
    try {
      const comment = await prisma.entranceComment.update({
        where: { id: BigInt(id) },
        data: {
          comment: updateData.comment,
          updated_at: new Date(),
        },
        include: {
          author: {
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          house: {
            select: {
              id: true,
              house: true,
            },
          },
        },
      });

      logger.info("Entrance comment updated", {
        commentId: comment.id,
        houseId: comment.house_id,
        entrance: comment.entrance,
      });

      return comment;
    } catch (error) {
      logger.error("Error updating entrance comment:", error);
      throw error;
    }
  }

  /**
   * Delete a comment
   */
  async delete(id) {
    try {
      await prisma.entranceComment.delete({
        where: { id: BigInt(id) },
      });

      logger.info("Entrance comment deleted", { commentId: id });
      return true;
    } catch (error) {
      logger.error("Error deleting entrance comment:", error);
      throw error;
    }
  }

  /**
   * Check if user can manage comment
   */
  async canUserManage(commentId, userId) {
    try {
      const comment = await prisma.entranceComment.findUnique({
        where: { id: BigInt(commentId) },
        select: { author_id: true },
      });

      if (!comment) {
        return false;
      }

      // User can manage if they are the author or admin
      const user = await prisma.user.findUnique({
        where: { user_id: BigInt(userId) },
        select: { role: true },
      });

      return (
        comment.author_id === BigInt(userId) || user?.role === true // Admin check
      );
    } catch (error) {
      logger.error(
        "Error checking user permissions for entrance comment:",
        error
      );
      return false;
    }
  }
}
