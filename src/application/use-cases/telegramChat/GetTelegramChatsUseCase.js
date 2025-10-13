/**
 * GetTelegramChatsUseCase
 * Retrieves all or filtered Telegram chats
 */
export class GetTelegramChatsUseCase {
  constructor(telegramChatRepository) {
    this.telegramChatRepository = telegramChatRepository;
  }

  async execute(filters = {}) {
    const { purpose, active_only, visible_to_all_only } = filters;

    if (active_only) {
      return await this.telegramChatRepository.getActiveChats(
        purpose || null,
        visible_to_all_only || false
      );
    }

    if (purpose) {
      return await this.telegramChatRepository.getByPurpose(purpose);
    }

    return await this.telegramChatRepository.getAll();
  }
}
