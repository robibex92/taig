import { ValidationError } from "../../../core/errors/AppError.js";

/**
 * CreateTelegramChatUseCase
 * Creates a new Telegram chat configuration
 */
export class CreateTelegramChatUseCase {
  constructor(telegramChatRepository) {
    this.telegramChatRepository = telegramChatRepository;
  }

  async execute(chatData) {
    // Validate required fields
    if (!chatData.chat_id) {
      throw new ValidationError("chat_id is required");
    }
    if (!chatData.name) {
      throw new ValidationError("name is required");
    }

    return await this.telegramChatRepository.create(chatData);
  }
}
