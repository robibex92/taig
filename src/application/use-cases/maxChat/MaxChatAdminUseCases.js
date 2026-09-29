import { NotFoundError, ValidationError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Управление реестром MAX-чатов (K4).
 *
 * Один файл с несколькими маленькими кейсами — по образцу `maxBot/`: CRUD над
 * реестром, и он же отдаёт справку о чате из MAX API, чтобы администратор
 * заводил чат не вслепую, а с проверкой, что бот в нём есть.
 */

export class GetMaxChatsUseCase {
  constructor(maxChatRepository) {
    this.maxChatRepository = maxChatRepository;
  }

  async execute(filters = {}) {
    const { purpose, active_only, visible_to_all_only } = filters;

    if (active_only) {
      return await this.maxChatRepository.getActiveChats(
        purpose || null,
        Boolean(visible_to_all_only)
      );
    }

    if (purpose) {
      return await this.maxChatRepository.getByPurpose(purpose);
    }

    return await this.maxChatRepository.getAll();
  }
}

export class CreateMaxChatUseCase {
  constructor(maxChatRepository) {
    this.maxChatRepository = maxChatRepository;
  }

  async execute(chatData) {
    if (!chatData?.chat_id) {
      throw new ValidationError("chat_id обязателен");
    }

    if (!chatData?.name) {
      throw new ValidationError("Название чата обязательно");
    }

    const existing = await this.maxChatRepository.findByChatId(chatData.chat_id);

    if (existing) {
      throw new ValidationError("Этот чат MAX уже добавлен в реестр");
    }

    const chat = await this.maxChatRepository.create(chatData);

    logger.info("MAX chat registered", {
      id: chat.id,
      chat_id: String(chat.chat_id),
      purpose: chat.purpose,
    });

    return chat;
  }
}

export class UpdateMaxChatUseCase {
  constructor(maxChatRepository) {
    this.maxChatRepository = maxChatRepository;
  }

  async execute(id, chatData) {
    const existing = await this.maxChatRepository.getById(id);

    if (!existing) {
      throw new NotFoundError("MAX chat");
    }

    if (chatData?.chat_id && String(chatData.chat_id) !== String(existing.chat_id)) {
      const taken = await this.maxChatRepository.findByChatId(chatData.chat_id);

      if (taken) {
        throw new ValidationError("Чат с таким chat_id уже в реестре");
      }
    }

    return await this.maxChatRepository.update(id, chatData);
  }
}

export class DeleteMaxChatUseCase {
  constructor(maxChatRepository) {
    this.maxChatRepository = maxChatRepository;
  }

  async execute(id) {
    const existing = await this.maxChatRepository.getById(id);

    if (!existing) {
      throw new NotFoundError("MAX chat");
    }

    await this.maxChatRepository.delete(id);

    logger.info("MAX chat removed from registry", {
      id,
      chat_id: String(existing.chat_id),
    });

    return true;
  }
}

/**
 * Справка о чате из MAX API (`GET /chats/{chat_id}`).
 *
 * Нужна, потому что списка чатов у бота нет: `GET /chats` на рабочем хосте
 * отвечает `method.not.found`, поэтому администратор вводит id вручную, а этот
 * вызов подтверждает, что id настоящий и бот в чат добавлен.
 */
export class LookupMaxChatUseCase {
  constructor(maxChatRepository, maxService) {
    this.maxChatRepository = maxChatRepository;
    this.maxService = maxService;
  }

  async execute(chatId) {
    if (!chatId) {
      throw new ValidationError("Не указан chat_id");
    }

    const info = await this.maxService.getChat(chatId);

    return {
      ...info,
      already_registered: Boolean(await this.maxChatRepository.findByChatId(chatId)),
    };
  }
}
