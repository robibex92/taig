import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * ToggleTelegramChatActiveUseCase
 * Toggles active/inactive status of a Telegram chat
 */
export class ToggleTelegramChatActiveUseCase {
  constructor(telegramChatRepository) {
    this.telegramChatRepository = telegramChatRepository;
  }

  async execute(id) {
    const existing = await this.telegramChatRepository.getById(id);
    if (!existing) {
      throw new NotFoundError("Telegram chat not found");
    }

    return await this.telegramChatRepository.toggleActive(id);
  }
}
