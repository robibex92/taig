import { prisma } from "../database/prisma.js";

/**
 * Условия автоответа (`chat_auto_replies`) — один реестр на оба канала.
 *
 * Порядок отдачи — по id: бот отвечает первым подошедшим условием, и админ,
 * глядя в список, видит, какое именно сработает, если фразы пересекаются.
 */
export class ChatAutoReplyRepository {
  async list({ platform = null, activeOnly = false } = {}) {
    const where = {};

    if (platform) where.platform = platform;
    if (activeOnly) where.is_active = true;

    return prisma.chatAutoReply.findMany({ where, orderBy: { id: "asc" } });
  }

  async getById(id) {
    return prisma.chatAutoReply.findUnique({ where: { id: BigInt(id) } });
  }

  /** Проверка уникальности пары «канал + фраза» до записи: DB-констраница есть,
   *  но в ответе админу нужна внятная фраза, а не P2002. */
  async findByPhrase(platform, phrase) {
    return prisma.chatAutoReply.findFirst({ where: { platform, phrase } });
  }

  async create({ platform, phrase, response, isActive = true }) {
    return prisma.chatAutoReply.create({
      data: { platform, phrase, response, is_active: isActive },
    });
  }

  async update(id, { phrase, response, isActive }) {
    return prisma.chatAutoReply.update({
      where: { id: BigInt(id) },
      data: {
        ...(phrase !== undefined && { phrase }),
        ...(response !== undefined && { response }),
        ...(isActive !== undefined && { is_active: isActive }),
      },
    });
  }

  async delete(id) {
    return prisma.chatAutoReply.delete({ where: { id: BigInt(id) } });
  }
}

export default new ChatAutoReplyRepository();
