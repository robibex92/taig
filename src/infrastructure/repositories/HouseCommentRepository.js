import { prisma } from "../database/db.js";
import { logger } from "../../core/utils/logger.js";
import { isAdmin } from "../../core/utils/roles.js";

/**
 * House Comment Repository Implementation
 */
export class HouseCommentRepository {
  /**
   * Якорная запись дома — самая ранняя квартира этого номера.
   *
   * Нужна только чтобы заполнить легаси-колонку `house_id`; адресом комментария
   * служит `house_number`, потому что `houses` — таблица квартир, и привязанный
   * к квартире комментарий уезжал вместе с квартирой в другой дом.
   */
  async #anchorHouseId(houseNumber) {
    const house = await prisma.house.findFirst({
      where: { house: String(houseNumber) },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    return house?.id ?? null;
  }

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
      const anchorId = await this.#anchorHouseId(commentData.house_id);

      if (!anchorId) {
        throw new Error(
          `House with number "${commentData.house_id}" not found`
        );
      }

      const comment = await prisma.houseComment
        .create({
          data: {
            house_id: anchorId, // легаси-привязка к квартире
            house_number: String(commentData.house_id), // адрес здания
            author_id: commentData.author_id,
            comment: commentData.comment,
          },
        })
        .catch(async (error) => {
          /**
           * Уникальный индекс `house_number` не даст появиться второму тексту на
           * дом. Столкнуться может только одновременное сохранение двумя
           * администраторами, и по правилу «один текст на дом» это замена, а не
           * ошибка.
           */
          if (error?.code !== "P2002") throw error;

          const [latest] = await this.findByHouseNumber(commentData.house_id);
          if (!latest) throw error;

          return this.update(latest.id, { comment: commentData.comment });
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
   *
   * Адрес — `house_number`, точное значение колонки: `37` и `37/1` не пересекаются,
   * и переезд квартиры в другой дом текст больше не затрагивает.
   */
  async findByHouseNumber(houseNumber) {
    try {
      return prisma.houseComment.findMany({
        where: {
          house_number: String(houseNumber),
        },
        select: {
          id: true,
          comment: true,
          created_at: true,
          author_id: true,
          house_id: true,
          house_number: true,
        },
        orderBy: { created_at: "desc" },
      });
    } catch (error) {
      logger.error("Error finding house comments by house number:", error);
      throw error;
    }
  }

  /**
   * Get simple comment text for a house by house number (no author details)
   * Только точное совпадение: "39" — только для "39", "39/1" — только для "39/1"
   */
  async findSimpleCommentByHouseNumber(houseNumber) {
    try {
      if (!houseNumber || typeof houseNumber !== "string") {
        return null;
      }

      const comments = await this.findByHouseNumber(houseNumber.trim());

      return comments.length > 0 ? comments[0].comment : null;
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
        select: { roles: true },
      });

      return comment.author_id === BigInt(userId) || isAdmin(user);
    } catch (error) {
      logger.error("Error checking user permissions for house comment:", error);
      return false;
    }
  }
}
