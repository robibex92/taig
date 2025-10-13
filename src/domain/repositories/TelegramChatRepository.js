/**
 * TelegramChatRepository Interface
 * Defines contract for telegram chat data access
 */
export class TelegramChatRepository {
  async getAll() {
    throw new Error("getAll() must be implemented");
  }

  async getByPurpose(purpose) {
    throw new Error("getByPurpose() must be implemented");
  }

  async getActivechats(purpose = null) {
    throw new Error("getActiveChats() must be implemented");
  }

  async getById(id) {
    throw new Error("getById() must be implemented");
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

  async toggleActive(id) {
    throw new Error("toggleActive() must be implemented");
  }
}
