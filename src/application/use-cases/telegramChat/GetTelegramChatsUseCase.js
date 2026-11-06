/**
 * GetTelegramChatsUseCase
 * Retrieves all or filtered Telegram chats
 */
import { isModerator } from "../../../core/utils/roles.js";

export class GetTelegramChatsUseCase {
  constructor(telegramChatRepository) {
    this.telegramChatRepository = telegramChatRepository;
  }

  async execute(filters = {}, viewer = null) {
    const { purpose, active_only, visible_to_all_only } = filters;

    const chats = active_only
      ? await this.telegramChatRepository.getActiveChats(
          purpose || null,
          visible_to_all_only || false
        )
      : purpose
        ? await this.telegramChatRepository.getByPurpose(purpose)
        : await this.telegramChatRepository.getAll();

    // Публикации объявления нужен только выбор «в какой чат» — id и имя.
    // `chat_id` и `thread_id` это адреса доставки бота: они нужны экрану
    // реестра, то есть модерации и выше, а не каждому жителю.
    if (isModerator(viewer)) {
      return chats;
    }

    return chats.map(({ id, name, purpose: chatPurpose, chat_type: chatType }) => ({
      id,
      name,
      purpose: chatPurpose,
      chat_type: chatType,
    }));
  }
}
