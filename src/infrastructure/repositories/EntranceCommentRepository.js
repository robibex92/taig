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
    const comment = await prisma.entranceComment.create({
      data: {
        house_id: commentData.house_id,
        entrance: commentData.entrance,
        author_id: commentData.author_id,
        comment: commentData.comment,
      },
    });

    logger.info("Entrance comment created", {
      commentId: comment.id,
      houseId: comment.house_id,
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
   * `house_ids` — все записи этого номера дома (см. `HouseRepository.findIdsByHouseNumber`):
   * строки комментариев легли на разные квартиры одного здания, искать по одной
   * «первой» квартире нельзя.
   */
  async findByHouseIdsAndEntrance(house_ids, entrance) {
    if (!house_ids.length) return null;

    return prisma.entranceComment.findFirst({
      where: { house_id: { in: house_ids }, entrance: Number(entrance) },
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
