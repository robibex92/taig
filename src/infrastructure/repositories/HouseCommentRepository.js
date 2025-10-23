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
      // Проверяем, существует ли модель в Prisma клиенте
      if (!prisma.houseComment) {
        console.error(
          "Prisma model 'houseComment' not found. Please run 'npx prisma generate'"
        );
        throw new Error(
          "Prisma model not found. Please regenerate Prisma client."
        );
      }

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

      // Filter out comments where author is null (broken references)
      return comments.filter((comment) => comment.author !== null);
    } catch (error) {
      logger.error("Error finding house comments by house ID:", error);
      throw error;
    }
  }

  /**
   * Get comments for a specific house by house number
   */
  async findByHouseNumber(houseNumber) {
    try {
      // Сначала получаем все комментарии без include author
      const comments = await prisma.houseComment.findMany({
        where: {
          house: {
            house: houseNumber,
          },
        },
        select: {
          id: true,
          comment: true,
          created_at: true,
          author_id: true,
          house: {
            select: {
              id: true,
              house: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      });

      // Фильтруем комментарии с валидными авторами
      const validComments = comments.filter(comment => comment.author_id !== null);

      // Теперь получаем данные авторов только для валидных комментариев
      const commentsWithAuthors = [];
      for (const comment of validComments) {
        try {
          const author = await prisma.user.findUnique({
            where: { user_id: comment.author_id },
            select: {
              user_id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          });

          if (author) {
            commentsWithAuthors.push({
              ...comment,
              author,
            });
          }
        } catch (authorError) {
          // Пропускаем комментарии с проблемными авторами
          logger.warn(`Skipping comment ${comment.id} due to author lookup error:`, authorError);
        }
      }

      return commentsWithAuthors;
    } catch (error) {
      logger.error("Error finding house comments by house number:", error);
      throw error;
    }
  }

  /**
   * Find house ID by house number
   */
  async findHouseIdByNumber(houseNumber) {
    try {
      const house = await prisma.house.findFirst({
        where: { house: houseNumber },
        select: { id: true },
      });

      return house ? Number(house.id) : null;
    } catch (error) {
      logger.error("Error finding house ID by house number:", error);
      throw error;
    }
  }

  /**
   * Get simple comment text for a house by house number (no author details)
   */
  async findSimpleCommentByHouseNumber(houseNumber) {
    try {
      // Сначала находим house_id по номеру дома
      const house = await prisma.house.findFirst({
        where: {
          house: houseNumber,
        },
        select: {
          id: true,
        },
      });

      if (!house) {
        return null;
      }

      // Затем получаем комментарии для этого дома
      const comments = await prisma.houseComment.findMany({
        where: {
          house_id: house.id,
        },
        select: {
          comment: true,
          author_id: true,
        },
        orderBy: { created_at: "desc" },
      });

      // Фильтруем комментарии с валидными авторами и возвращаем первый
      const validComment = comments.find(comment => comment.author_id !== null);
      
      return validComment ? validComment.comment : null;
    } catch (error) {
      logger.error("Error finding simple comment by house number:", error);
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
