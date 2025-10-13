import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * DeleteTelegramChatUseCase
 * Deletes a Telegram chat configuration
 */
export class DeleteTelegramChatUseCase {
  constructor(telegramChatRepository) {
    this.telegramChatRepository = telegramChatRepository;
  }

  async execute(id) {
    const existing = await this.telegramChatRepository.getById(id);
    if (!existing) {
      throw new NotFoundError("Telegram chat not found");
    }

    return await this.telegramChatRepository.delete(id);
  }
}
