import { prisma } from "../database/prisma.js";
import { IMaxChatRepository } from "../../domain/repositories/IMaxChatRepository.js";
import { ValidationError } from "../../core/errors/AppError.js";

/**
 * Реестр MAX-чатов (`max_chats`).
 *
 * `chat_id` — настоящий идентификатор чата в MAX (int64), именно его принимает
 * `POST /messages?chat_id=`. `id` — внутренняя запись: по ней фронт отмечает
 * чаты при публикации, и по ней же нельзя ничего отправлять в MAX.
 */
export class MaxChatRepository extends IMaxChatRepository {
  _chatId(value) {
    const asBigInt = BigInt(String(value).trim());

    if (asBigInt <= 0n) {
      throw new ValidationError("chat_id должен быть положительным числом");
    }

    return asBigInt;
  }

  async getAll() {
    return await prisma.maxChat.findMany({
      orderBy: [{ purpose: "asc" }, { name: "asc" }],
    });
  }

  async getByPurpose(purpose) {
    return await prisma.maxChat.findMany({
      where: { purpose },
      orderBy: { name: "asc" },
    });
  }

  async getActiveChats(purpose = null, visibleToAllOnly = false) {
    const where = { is_active: true };

    if (purpose) {
      where.purpose = purpose;
    }

    if (visibleToAllOnly) {
      where.visible_to_all = true;
    }

    return await prisma.maxChat.findMany({ where, orderBy: { name: "asc" } });
  }

  async getById(id) {
    return await prisma.maxChat.findUnique({ where: { id: BigInt(id) } });
  }

  async findByChatId(chatId) {
    return await prisma.maxChat.findUnique({
      where: { chat_id: this._chatId(chatId) },
    });
  }

  async create(chatData) {
    return await prisma.maxChat.create({
      data: {
        chat_id: this._chatId(chatData.chat_id),
        name: chatData.name,
        description: chatData.description || null,
        chat_type: chatData.chat_type || "CHAT",
        purpose: chatData.purpose || "ads",
        is_active: chatData.is_active ?? true,
        visible_to_all: chatData.visible_to_all ?? true,
      },
    });
  }

  async update(id, chatData) {
    return await prisma.maxChat.update({
      where: { id: BigInt(id) },
      data: {
        ...(chatData.chat_id !== undefined && {
          chat_id: this._chatId(chatData.chat_id),
        }),
        ...(chatData.name !== undefined && { name: chatData.name }),
        ...(chatData.description !== undefined && {
          description: chatData.description || null,
        }),
        ...(chatData.chat_type !== undefined && { chat_type: chatData.chat_type }),
        ...(chatData.purpose !== undefined && { purpose: chatData.purpose }),
        ...(chatData.is_active !== undefined && { is_active: chatData.is_active }),
        ...(chatData.visible_to_all !== undefined && {
          visible_to_all: chatData.visible_to_all,
        }),
      },
    });
  }

  async delete(id) {
    return await prisma.maxChat.delete({ where: { id: BigInt(id) } });
  }
}

export default new MaxChatRepository();
