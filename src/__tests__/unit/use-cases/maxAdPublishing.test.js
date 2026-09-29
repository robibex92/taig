import { buildMaxAdMessageText, publishToMaxChats, removeAdFromMaxChats } from "../../../application/use-cases/ad/maxAdPublishing.js";

/**
 * Публикация объявления в MAX-чаты (K4). Тесты на заглушках сервиса: живой
 * MAX API с этой машины недоступен, поэтому проверяем договорённость — кому,
 * чем и что мы записываем в журнал.
 */

const ad = {
  id: 42,
  title: "Продам велосипед",
  content: "Состояние отличное",
  price: "12000",
  user: { username: "rabota" },
};

const okService = () => ({
  sent: [],
  deleted: [],
  async sendChatMessage(chatId, text) {
    this.sent.push({ chatId, text });
    return { ok: true, message_id: `msg-${chatId}` };
  },
  async deleteMessage(messageId) {
    this.deleted.push(messageId);
    return { ok: true };
  },
});

const repository = () => {
  const journal = [];

  return {
    journal,
    async createMaxMessage(row) {
      journal.push(row);
    },
    async deleteMaxMessagesByAdId() {
      journal.length = 0;
    },
  };
};

describe("buildMaxAdMessageText", () => {
  it("собирает текст без HTML и со ссылкой на объявление", () => {
    const text = buildMaxAdMessageText(ad);

    expect(text).toContain("Продам велосипед");
    expect(text).toContain("Состояние отличное");
    expect(text).toContain("12000");
    expect(text).toContain("@rabota");
    expect(text).toContain("/#/ads/42");
    expect(text).not.toContain("<b>");
  });
});

describe("publishToMaxChats", () => {
  it("отправляет в каждый чат и записывает журнал", async () => {
    const maxService = okService();
    const adRepository = repository();

    const published = await publishToMaxChats({
      ad,
      chats: [{ chat_id: "111" }, { chat_id: "222" }],
      maxService,
      adRepository,
    });

    expect(published).toBe(2);
    expect(maxService.sent.map((s) => s.chatId)).toEqual(["111", "222"]);
    expect(adRepository.journal).toEqual([
      { ad_id: 42, chat_id: "111", message_id: "msg-111" },
      { ad_id: 42, chat_id: "222", message_id: "msg-222" },
    ]);
  });

  it("сбой одного чата не отменяет остальные и не бросает наружу", async () => {
    const maxService = {
      async sendChatMessage(chatId) {
        if (chatId === "111") return { ok: false, error: "бот не в чате", code: "chat.not.found" };
        return { ok: true, message_id: "msg-222" };
      },
    };
    const adRepository = repository();

    const published = await publishToMaxChats({
      ad,
      chats: [{ chat_id: "111" }, { chat_id: "222" }],
      maxService,
      adRepository,
    });

    expect(published).toBe(1);
    expect(adRepository.journal).toEqual([{ ad_id: 42, chat_id: "222", message_id: "msg-222" }]);
  });
});

describe("removeAdFromMaxChats", () => {
  it("снимает сообщения и чистит журнал", async () => {
    const maxService = okService();
    const adRepository = repository();
    adRepository.journal.push({ ad_id: 42, chat_id: "111", message_id: "msg-111" });

    const result = await removeAdFromMaxChats({
      messages: [{ chat_id: "111", message_id: "msg-111" }],
      maxService,
      adRepository,
      adId: 42,
      reason: "archive",
    });

    expect(result).toEqual({ deleted: 1, total: 1 });
    expect(maxService.deleted).toEqual(["msg-111"]);
    expect(adRepository.journal).toHaveLength(0);
  });
});
