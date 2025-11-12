import { prisma } from "../database/db.js";
import { TelegramChatRepository as ITelegramChatRepository } from "../../domain/repositories/TelegramChatRepository.js";

export class TelegramChatRepository extends ITelegramChatRepository {
  async getAll() {
    return await prisma.telegramChat.findMany({
      orderBy: [{ purpose: "asc" }, { name: "asc" }],
    });
  }

  async getByPurpose(purpose) {
    return await prisma.telegramChat.findMany({
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

    return await prisma.telegramChat.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  async getById(id) {
    return await prisma.telegramChat.findUnique({
      where: { id: parseInt(id) },
    });
  }

  async findByIds(ids) {
    if (!ids || ids.length === 0) {
      return [];
    }
    const intIds = ids.map((id) => parseInt(id)).filter(id => !isNaN(id));
    if (intIds.length === 0) {
        return [];
    }
    return await prisma.telegramChat.findMany({
      where: {
        id: {
          in: intIds,
        },
      },
    });
  }

  async create(chatData) {
    return await prisma.telegramChat.create({
      data: {
        chat_id: chatData.chat_id,
        thread_id: chatData.thread_id || null,
        name: chatData.name,
        description: chatData.description || null,
        chat_type: chatData.chat_type || "group",
        is_active: chatData.is_active ?? true,
        purpose: chatData.purpose || "general",
        visible_to_all: chatData.visible_to_all ?? true,
      },
    });
  }

  async update(id, chatData) {
    return await prisma.telegramChat.update({
      where: { id: parseInt(id) },
      data: {
        ...(chatData.chat_id !== undefined && { chat_id: chatData.chat_id }),
        ...(chatData.thread_id !== undefined && {
          thread_id: chatData.thread_id,
        }),
        ...(chatData.name !== undefined && { name: chatData.name }),
        ...(chatData.description !== undefined && {
          description: chatData.description,
        }),
        ...(chatData.chat_type !== undefined && {
          chat_type: chatData.chat_type,
        }),
        ...(chatData.is_active !== undefined && {
          is_active: chatData.is_active,
        }),
        ...(chatData.purpose !== undefined && { purpose: chatData.purpose }),
        ...(chatData.visible_to_all !== undefined && {
          visible_to_all: chatData.visible_to_all,
        }),
      },
    });
  }

  async delete(id) {
    return await prisma.telegramChat.delete({
      where: { id: parseInt(id) },
    });
  }

  async toggleActive(id) {
    const chat = await this.getById(id);
    if (!chat) {
      throw new Error("Chat not found");
    }

    return await prisma.telegramChat.update({
      where: { id: parseInt(id) },
      data: { is_active: !chat.is_active },
    });
  }
}
