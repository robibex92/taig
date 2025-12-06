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
      // Проверяем, существует ли модель в Prisma клиенте
      if (!prisma.entranceComment) {
        console.error(
          "Prisma model 'entranceComment' not found. Please run 'npx prisma generate'"
        );
        throw new Error(
          "Prisma model not found. Please regenerate Prisma client."
        );
      }

      const comment = await prisma.entranceComment.create({
        data: {
          house_id: commentData.house_id,
          entrance: commentData.entrance,
          author_id: commentData.author_id,
          comment: commentData.comment,
        },
        include: {
          // house: {
          //   select: {
          //     id: true,
          //     house: true,
          //   },
          // },
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
          // house: {
          //   select: {
          //     id: true,
          //     house: true,
          //   },
          // },
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
      // Проверяем, существует ли модель в Prisma клиенте
      if (!prisma.entranceComment) {
        console.error(
          "Prisma model 'entranceComment' not found. Please run 'npx prisma generate'"
        );
        throw new Error(
          "Prisma model not found. Please regenerate Prisma client."
        );
      }

      console.log(
        `Looking for entrance comment: house_id=${house_id}, entrance=${entrance}`
      );

      const comment = await prisma.entranceComment.findFirst({
        where: {
          house_id: BigInt(house_id),
          entrance: entrance,
        },
        include: {
          // house: {
          //   select: {
          //     id: true,
          //     house: true,
          //   },
          // },
        },
      });

      console.log(`Found entrance comment:`, comment ? "yes" : "no");
      return comment;
    } catch (error) {
      logger.error(
        "Error finding entrance comment by house and entrance:",
        error
      );
      console.error("Detailed error:", error);
      throw error;
    }
  }

  /**
   * Get simple entrance comment by house number and entrance (no author details)
   */
  async findSimpleCommentByHouseNumberAndEntrance(houseNumber, entrance) {
    try {
      // Проверяем, существует ли модель в Prisma клиенте
      if (!prisma.entranceComment) {
        console.error(
          "Prisma model 'entranceComment' not found. Please run 'npx prisma generate'"
        );
        throw new Error(
          "Prisma model not found. Please regenerate Prisma client."
        );
      }

      console.log(
        `Looking for simple entrance comment: house=${houseNumber}, entrance=${entrance}`
      );

      // Сначала получаем все комментарии без include author
      const comments = await prisma.entranceComment.findMany({
        where: {
          house: {
            house: houseNumber,
          },
          entrance: parseInt(entrance),
        },
        select: {
          comment: true,
          author_id: true,
        },
        orderBy: { created_at: "desc" },
      });

      // Фильтруем комментарии с валидными авторами и возвращаем первый
      const validComment = comments.find(
        (comment) => comment.author_id !== null
      );

      console.log(
        `Found simple entrance comment:`,
        validComment ? "yes" : "no"
      );
      return validComment ? validComment.comment : null;
    } catch (error) {
      logger.error(
        "Error finding simple entrance comment by house number and entrance:",
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
          // house: {
          //   select: {
          //     id: true,
          //     house: true,
          //   },
          // },
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
          // house: {
          //   select: {
          //     id: true,
          //     house: true,
          //   },
          // },
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
