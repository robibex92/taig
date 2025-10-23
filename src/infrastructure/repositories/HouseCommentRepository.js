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

      // Находим house_id по номеру дома
      const house = await prisma.house.findFirst({
        where: {
          house: String(commentData.house_id),
        },
        select: {
          id: true,
        },
      });

      if (!house) {
        throw new Error(`House with number "${commentData.house_id}" not found`);
      }

      const comment = await prisma.houseComment.create({
        data: {
          house_id: house.id, // Используем найденный house_id
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
        },
      });

      logger.info("House comment created", {
        commentId: comment.id,
        houseId: comment.house_id,
        authorId: comment.author_id,
        authorIdType: typeof comment.author_id,
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

      // Возвращаем все комментарии без фильтрации по автору
      return comments;
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
      // Находим house_id по номеру дома
      const house = await prisma.house.findFirst({
        where: {
          house: houseNumber,
        },
        select: {
          id: true,
        },
      });

      if (!house) {
        return [];
      }

      // Ищем комментарии по найденному house_id
      const comments = await prisma.houseComment.findMany({
        where: {
          house_id: house.id,
        },
        select: {
          id: true,
          comment: true,
          created_at: true,
          author_id: true,
          house_id: true,
        },
        orderBy: { created_at: "desc" },
      });

      // Возвращаем все комментарии без фильтрации по автору
      return comments;
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
      console.log(
        `findHouseIdByNumber: Looking for house with number: "${houseNumber}"`
      );

      // Ищем дом точно по номеру
      let house = await prisma.house.findFirst({
        where: { house: houseNumber },
        select: { id: true, house: true },
      });

      console.log(`findHouseIdByNumber: Exact house found:`, house);

      // Если точного совпадения нет, ищем дом который начинается с этого номера
      // НО только если номер дома не содержит "/" и не является частью другого номера
      if (!house && houseNumber && !houseNumber.includes("/")) {
        console.log(
          `findHouseIdByNumber: Looking for house that starts with: "${houseNumber}"`
        );
        house = await prisma.house.findFirst({
          where: {
            house: {
              startsWith: houseNumber,
            },
          },
          select: { id: true, house: true },
        });
        console.log(
          `findHouseIdByNumber: House starting with "${houseNumber}" found:`,
          house
        );

        // Проверяем, что найденный дом не является поддомом (например, 39/1 когда ищем 39)
        if (house && house.house !== houseNumber && house.house.includes("/")) {
          console.log(
            `findHouseIdByNumber: Found house "${house.house}" but it's a sub-house, not exact match for "${houseNumber}"`
          );
          house = null;
        }
      }

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
      console.log(`Looking for comments with house_id: "${houseNumber}"`);

      // Находим house_id по номеру дома
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

      // Ищем комментарии по найденному house_id
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

      console.log(
        `Found ${comments.length} comments for house ${houseNumber}:`,
        comments
      );

      // Возвращаем первый комментарий (самый новый), если он есть
      const latestComment = comments.length > 0 ? comments[0] : null;

      console.log(`Latest comment found:`, latestComment);

      return latestComment ? latestComment.comment : null;
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
