import { prisma } from "../database/db.js";
import { logger } from "../../core/utils/logger.js";
import { isAdmin } from "../../core/utils/roles.js";

/**
 * Entrance Comment Repository Implementation
 */
export class EntranceCommentRepository {
  /**
   * Create a new entrance comment
   */
  async create(commentData) {
    const comment = await prisma.entranceComment
      .create({
        data: {
          house_id: commentData.house_id,
          house_number: commentData.house_number,
          entrance: commentData.entrance,
          author_id: commentData.author_id,
          comment: commentData.comment,
        },
      })
      .catch(async (error) => {
        // Один текст на подъезд: одновременное сохранение двумя администраторами
        // означает замену, а не вторую строку.
        if (error?.code !== "P2002") throw error;

        const latest = await this.findByHouseNumberAndEntrance(
          commentData.house_number,
          commentData.entrance
        );
        if (!latest) throw error;

        return this.update(latest.id, { comment: commentData.comment });
      });

    logger.info("Entrance comment created", {
      commentId: comment.id,
      houseId: comment.house_id,
      houseNumber: comment.house_number,
      entrance: comment.entrance,
      authorId: comment.author_id,
    });

    return comment;
  }

  /**
   * Get comment by ID
   */
  async findById(id) {
    return prisma.entranceComment.findUnique({
      where: { id: BigInt(id) },
    });
  }

  /**
   * Get comment for a specific house entrance
   *
   * Всегда с `orderBy: created_at desc`: «последний» комментарий подъезда не должен
   * зависеть от порядка строк в БД.
   *
   * Адрес — номер дома целиком (`39/1` ≠ `39`), а не id квартиры: `houses` — таблица
   * квартир, и строка, привязанная к квартире, уезжала вместе с ней в другой дом.
   */
  async findByHouseNumberAndEntrance(house_number, entrance) {
    return prisma.entranceComment.findFirst({
      where: { house_number: String(house_number), entrance: Number(entrance) },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Update a comment
   */
  async update(id, updateData) {
    const comment = await prisma.entranceComment.update({
      where: { id: BigInt(id) },
      data: {
        comment: updateData.comment,
        updated_at: new Date(),
      },
    });

    logger.info("Entrance comment updated", {
      commentId: comment.id,
      houseId: comment.house_id,
      entrance: comment.entrance,
    });

    return comment;
  }

  /**
   * Delete a comment
   */
  async delete(id) {
    await prisma.entranceComment.delete({
      where: { id: BigInt(id) },
    });

    logger.info("Entrance comment deleted", { commentId: id });
    return true;
  }

  /**
   * Check if user can manage comment
   */
  async canUserManage(commentId, userId) {
    const comment = await prisma.entranceComment.findUnique({
      where: { id: BigInt(commentId) },
      select: { author_id: true },
    });

    if (!comment) {
      return false;
    }

    // Автор не требует второго запроса к пользователю.
    if (comment.author_id === BigInt(userId)) {
      return true;
    }

    const user = await prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
      select: { roles: true },
    });

    return isAdmin(user);
  }
}
