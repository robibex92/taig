import { prisma } from "../database/db.js";
import { logger } from "../../core/utils/logger.js";

/**
 * House Comment Repository Implementation
 */
export class HouseCommentRepository {
  /**
   * Create a new house comment
   */
  async create(commentData) {
    try {
      const comment = await prisma.houseComment.create({
        data: {
          house_id: commentData.house_id,
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

      logger.info("House comment created", {
        commentId: comment.id,
        houseId: comment.house_id,
        authorId: comment.author_id,
      });

      return comment;
    } catch (error) {
      logger.error("Error creating house comment:", error);
      throw error;
    }
  }

  /**
   * Get comment by ID
   */
  async findById(id) {
    try {
      const comment = await prisma.houseComment.findUnique({
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
      logger.error("Error finding house comment by ID:", error);
      throw error;
    }
  }

  /**
   * Get comments for a specific house
   */
  async findByHouseId(house_id) {
    try {
      const comments = await prisma.houseComment.findMany({
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
        orderBy: { created_at: "desc" },
      });

      return comments;
    } catch (error) {
      logger.error("Error finding house comments by house ID:", error);
      throw error;
    }
  }

  /**
   * Update a comment
   */
  async update(id, updateData) {
    try {
      const comment = await prisma.houseComment.update({
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

      logger.info("House comment updated", {
        commentId: comment.id,
        houseId: comment.house_id,
      });

      return comment;
    } catch (error) {
      logger.error("Error updating house comment:", error);
      throw error;
    }
  }

  /**
   * Delete a comment
   */
  async delete(id) {
    try {
      await prisma.houseComment.delete({
        where: { id: BigInt(id) },
      });

      logger.info("House comment deleted", { commentId: id });
      return true;
    } catch (error) {
      logger.error("Error deleting house comment:", error);
      throw error;
    }
  }

  /**
   * Check if user can manage comment
   */
  async canUserManage(commentId, userId) {
    try {
      const comment = await prisma.houseComment.findUnique({
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
      logger.error("Error checking user permissions for house comment:", error);
      return false;
    }
  }
}
