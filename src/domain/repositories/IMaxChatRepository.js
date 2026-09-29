/**
 * Контракт реестра MAX-чатов.
 *
 * Зеркало `telegram_chats`, потому что выбор целей публикации один и тот же:
 * активные чаты по назначению, видимость для «всех» или только для управляющих.
 */
export class IMaxChatRepository {
  async getAll() {
    throw new Error("getAll() must be implemented");
  }

  async getByPurpose(purpose) {
    throw new Error("getByPurpose() must be implemented");
  }

  async getActiveChats(purpose = null, visibleToAllOnly = false) {
    throw new Error("getActiveChats() must be implemented");
  }

  async getById(id) {
    throw new Error("getById() must be implemented");
  }

  async findByChatId(chatId) {
    throw new Error("findByChatId() must be implemented");
  }

  async create(chatData) {
    throw new Error("create() must be implemented");
  }

  async update(id, chatData) {
    throw new Error("update() must be implemented");
  }

  async delete(id) {
    throw new Error("delete() must be implemented");
  }
}

export default IMaxChatRepository;
