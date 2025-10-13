import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * UpdateTelegramChatUseCase
 * Updates an existing Telegram chat configuration
 */
export class UpdateTelegramChatUseCase {
  constructor(telegramChatRepository) {
    this.telegramChatRepository = telegramChatRepository;
  }

  async execute(id, chatData) {
    const existing = await this.telegramChatRepository.getById(id);
    if (!existing) {
      throw new NotFoundError("Telegram chat not found");
    }

    return await this.telegramChatRepository.update(id, chatData);
  }
}
