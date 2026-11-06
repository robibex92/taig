/* eslint-env jest */
/**
 * Реестры чатов: форма публикации не должна получать адреса доставки.
 *
 * `GET /api/telegram-chats` и `GET /api/max-chats` требовали только входа в
 * аккаунт и отдавали строки целиком: `chat_id`, `thread_id`, назначение и
 * описание. Это адреса, по которым бот пишет домой, — настройка дома, а не
 * выбор жильца. Форме публикации нужны id и название.
 */

import { GetTelegramChatsUseCase } from "../../../application/use-cases/telegramChat/GetTelegramChatsUseCase.js";
import { GetMaxChatsUseCase } from "../../../application/use-cases/maxChat/MaxChatAdminUseCases.js";
import { TelegramChatController } from "../../../presentation/controllers/TelegramChatController.js";
import { MaxChatController } from "../../../presentation/controllers/MaxChatController.js";

const resident = { user_id: 8n, roles: [] };
const moderator = { user_id: 1n, roles: ["global:moderator"] };

const rows = [
  {
    id: 3n,
    name: "Тайгинский 39 / Общий",
    purpose: "general",
    chat_type: "group",
    chat_id: "-1001234567890",
    thread_id: 42,
    description: "дом без бота",
  },
];

const repository = (list = rows) => ({
  getAll: async () => list,
  getActiveChats: async () => list,
  getByPurpose: async () => list,
});

const publicKeys = ["chat_id", "thread_id", "description"];

describe("GetTelegramChatsUseCase", () => {
  it("гостю и жильцу — только выбор «в какой чат»", async () => {
    const useCase = new GetTelegramChatsUseCase(repository());

    for (const viewer of [null, resident]) {
      const chats = await useCase.execute({}, viewer);

      expect(chats).toEqual([
        { id: 3n, name: "Тайгинский 39 / Общий", purpose: "general", chat_type: "group" },
      ]);
      publicKeys.forEach((key) => expect(chats[0]).not.toHaveProperty(key));
    }
  });

  it("модерация видит реестр целиком", async () => {
    const useCase = new GetTelegramChatsUseCase(repository());

    const chats = await useCase.execute({}, moderator);

    expect(chats[0].chat_id).toBe("-1001234567890");
    expect(chats[0].thread_id).toBe(42);
  });
});

describe("GetMaxChatsUseCase", () => {
  it("жильцу — id и название, без chat_id", async () => {
    const useCase = new GetMaxChatsUseCase(repository());

    const chats = await useCase.execute({ active_only: true }, resident);

    expect(chats).toEqual([
      { id: 3n, name: "Тайгинский 39 / Общий", purpose: "general", chat_type: "group" },
    ]);
  });

  it("администратору — полная строка", async () => {
    const useCase = new GetMaxChatsUseCase(repository());

    const chats = await useCase.execute({}, { user_id: 1n, roles: ["global:admin"] });

    expect(chats[0].chat_id).toBe("-1001234567890");
  });
});

describe("контроллеры передают смотрителя", () => {
  const seen = [];
  const spy = async (args, viewer) => {
    seen.push(viewer);
    return [];
  };
  const response = () => ({ status: () => ({ json: () => {} }) });
  const next = (error) => {
    throw error;
  };

  it("telegram-реестр", async () => {
    const controller = new TelegramChatController({ execute: spy }, null, null, null, null);

    await controller.getChats({ query: {}, user: resident }, response(), next);
    expect(seen.at(-1)).toBe(resident);
  });

  it("max-реестр", async () => {
    const controller = new MaxChatController({
      getMaxChatsUseCase: { execute: spy },
    });

    await controller.getChats({ query: {}, user: moderator }, response(), next);
    expect(seen.at(-1)).toBe(moderator);
  });
});
