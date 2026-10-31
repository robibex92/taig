/* eslint-env jest */
/**
 * Автоответы в чатах: движок, развилка поллера MAX и проверки админской формы.
 *
 * Главный смысл, который тут защищается: сообщение из зарегистрированного
 * группового чата НЕ попадает в inbox (там только обращения жителей лично боту),
 * а в чат уходит ровно один ответ — первое по id подошедшее условие.
 */

import { jest } from "@jest/globals";
import { ChatAutoReplyService } from "../../../application/services/ChatAutoReplyService.js";
import { ChatBotAdminUseCases } from "../../../application/use-cases/chatBot/ChatBotAdminUseCases.js";
import { MaxBotUpdatePoller } from "../../../infrastructure/services/MaxBotUpdatePoller.js";
import {
  CHAT_BOT_PLATFORM,
  CHAT_MESSAGE_FRESH_MS,
  isFreshChatMessage,
} from "../../../core/utils/chatAutoReply.js";

const logger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });

const replyRow = (id, phrase, response, isActive = true) => ({
  id: BigInt(id),
  platform: CHAT_BOT_PLATFORM.MAX,
  phrase,
  response,
  is_active: isActive,
});

const buildService = (rows) => {
  const repository = { list: jest.fn(async () => rows.filter((row) => row.is_active)) };

  return {
    repository,
    service: new ChatAutoReplyService({ repository, loggerImpl: logger(), ttlMs: 5000 }),
  };
};

/**
 * Прогон одной пачки событий через те же методы, что живёт в цикле поллера:
 * развилка чат/диалог → фильтр свежести → автоответ → продвижение порога.
 */
const sweep = async (poller, incoming, payloadMarker) => {
  const { dialogs, groupMessages } = await poller._splitByChat(incoming);
  const { fresh, stale } = poller._newGroupMessages(groupMessages);

  for (const item of fresh) {
    await poller._handleGroupMessage(item);
  }

  await poller._advanceReplyMarker(payloadMarker, [...fresh, ...stale]);

  return { fresh, stale, dialogs };
};

const chatRow = { id: 7n, chat_id: 500100n, name: "Чат дома 39", chat_type: "CHAT", is_active: true };

/**
 * Поллер с подставными БД, MAX API, реестром чатов и движком автоответов.
 * `state` — содержимое `max_bot_state`, `replyMarker` — порог свежести в памяти,
 * `chatInfo` — ответ `GET /chats/{id}` для чатов, которых нет в реестре.
 */
const buildPoller = ({ chat, rows, state = {}, replyMarker = null, chatInfo = null }) => {
  const db = {
    maxBotInboxMessage: { findUnique: jest.fn(async () => null), create: jest.fn(async () => ({})) },
    maxBotState: {
      findMany: jest.fn(async ({ where }) =>
        where.key.in
          .filter((key) => state[key] !== undefined)
          .map((key) => ({ key, value: String(state[key]) }))
      ),
      upsert: jest.fn(async ({ create, update }) => {
        state[create.key] = update.value;
        return {};
      }),
    },
  };
  const service = {
    isConfigured: jest.fn(() => true),
    sendChatMessage: jest.fn(async () => ({ ok: true })),
    getChat: jest.fn(async (chatId) => {
      if (!chatInfo) throw new Error(`chat.not.found: ${chatId}`);
      return { chat_id: String(chatId), title: chatInfo.title ?? null, type: chatInfo.type };
    }),
  };
  const chats = { findByChatId: jest.fn(async () => chat) };
  const autoReplies = new ChatAutoReplyService({
    repository: { list: jest.fn(async () => rows.filter((row) => row.is_active)) },
    loggerImpl: logger(),
  });

  const poller = new MaxBotUpdatePoller({
    db,
    service,
    chatRepository: chats,
    autoReplies,
    loggerImpl: logger(),
  });
  poller.replyMarker = replyMarker === null ? null : String(replyMarker);

  return { db, poller, service, chats, state };
};

/** Нормализованное входящее событие, как его отдаёт `parseMaxUpdatesPayload`. */
const chatEvent = (marker, { text = "телефон ук", chat_id = "500100", chat_type = null } = {}) => ({
  max_user_id: "42",
  text,
  display_name: null,
  username: null,
  marker: marker === null ? null : String(marker),
  update_type: "message_created",
  chat_id,
  chat_type,
});

describe("движок автоответов", () => {
  it("отвечает один раз и тем условием, которое раньше заведено", async () => {
    const { service } = buildService([
      replyRow(1, "телефон ук", "+7 383 233-02-03"),
      replyRow(2, "телефон", "это не то условие"),
    ]);
    const send = jest.fn(async () => ({ ok: true }));

    const result = await service.handleChatMessage({
      platform: CHAT_BOT_PLATFORM.MAX,
      chatLabel: "500100",
      text: "Добрый день, подскажите ТЕЛЕФОН  УК пожалуйста",
      send,
    });

    expect(result).toEqual({ sent: true, phrase: "телефон ук", error: null });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("+7 383 233-02-03");
  });

  it("молчит, когда условие не подошло, и не ходит в канал", async () => {
    const { service } = buildService([replyRow(1, "телефон ук", "ответ")]);
    const send = jest.fn();

    const result = await service.handleChatMessage({
      platform: CHAT_BOT_PLATFORM.MAX,
      chatLabel: "500100",
      text: "телефон укзамена не ищите",
      send,
    });

    expect(result.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("сбой канала — это sent:false с причиной, а не исключение", async () => {
    const { service } = buildService([replyRow(1, "телефон ук", "ответ")]);

    const result = await service.handleChatMessage({
      platform: CHAT_BOT_PLATFORM.MAX,
      chatLabel: "500100",
      text: "телефон ук",
      send: async () => ({ ok: false, error: "Бот выведен из чата" }),
    });

    expect(result).toEqual({ sent: false, phrase: "телефон ук", error: "Бот выведен из чата" });
  });

  it("список условий кэшируется, а правка из админки кэш сбрасывает", async () => {
    const rows = [replyRow(1, "телефон ук", "первый ответ")];
    const { repository, service } = buildService(rows);
    const send = jest.fn(async () => ({ ok: true }));

    await service.handleChatMessage({ platform: "max", chatLabel: "1", text: "телефон ук", send });
    await service.handleChatMessage({ platform: "max", chatLabel: "1", text: "телефон ук", send });

    expect(repository.list).toHaveBeenCalledTimes(1);

    rows[0] = replyRow(1, "телефон ук", "второй ответ");
    service.invalidate("max");
    await service.handleChatMessage({ platform: "max", chatLabel: "1", text: "телефон ук", send });

    expect(repository.list).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith("второй ответ");
  });

  it("битый список условий — молчание, а не падение обработки чата", async () => {
    const repository = { list: jest.fn(async () => { throw new Error("БД недоступна"); }) };
    const service = new ChatAutoReplyService({ repository, loggerImpl: logger() });
    const send = jest.fn();

    const result = await service.handleChatMessage({
      platform: "max",
      chatLabel: "1",
      text: "телефон ук",
      send,
    });

    expect(result.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("свежесть сообщения: Telegram смотрит на дату", () => {
  const NOW_MS = Date.parse("2026-10-31T12:00:00.000Z");
  const unix = (minutesAgo) => Math.floor(NOW_MS / 1000) - minutesAgo * 60;

  it("сообщение в пределах окна рассматривается, старше — нет", () => {
    expect(isFreshChatMessage(unix(0), { now: NOW_MS })).toBe(true);
    expect(isFreshChatMessage(unix(4), { now: NOW_MS })).toBe(true);
    expect(isFreshChatMessage(unix(6), { now: NOW_MS })).toBe(false);
  });

  it("без валидной даты ответа не будет", () => {
    for (const value of [undefined, null, 0, "abc", -1]) {
      expect(isFreshChatMessage(value, { now: NOW_MS })).toBe(false);
    }
  });

  it("окно задано в минутах, а не секундах: вчерашнее сообщение мимо", () => {
    expect(isFreshChatMessage(unix(60 * 24), { now: NOW_MS })).toBe(false);
    expect(CHAT_MESSAGE_FRESH_MS).toBe(5 * 60 * 1000);
  });
});

describe("поллер MAX: группа или личный диалог", () => {
  const rows = [replyRow(1, "телефон ук", "+7 383 233-02-03")];
  const dialogRow = { ...chatRow, chat_type: "DIALOG" };

  it("сообщение из группы уходит в автоответ и не сохраняется в inbox", async () => {
    const { poller, service, db } = buildPoller({ chat: chatRow, rows });

    const { dialogs, groupMessages } = await poller._splitByChat([chatEvent(900, { text: "телефон ук?" })]);

    expect(dialogs).toEqual([]);
    expect(groupMessages).toHaveLength(1);

    await poller._handleGroupMessage(groupMessages[0]);

    expect(service.sendChatMessage).toHaveBeenCalledWith("500100", "+7 383 233-02-03");
    expect(db.maxBotInboxMessage.create).not.toHaveBeenCalled();
    expect(poller.stats.chatReplies).toBe(1);
  });

  it("выключенный чат реестра остаётся группой: флаг `is_active` — про публикации", async () => {
    const { poller } = buildPoller({ chat: { ...chatRow, is_active: false }, rows });
    const { groupMessages } = await poller._splitByChat([chatEvent(900)]);

    expect(groupMessages).toHaveLength(1);
  });

  it("группы нет в реестре — тип спрашивается у MAX, и бот отвечает", async () => {
    const { poller, service } = buildPoller({
      chat: null,
      rows,
      chatInfo: { type: "CHAT", title: "Дом 37" },
    });

    const { dialogs, groupMessages } = await poller._splitByChat([chatEvent(900, { chat_id: "500777" })]);

    expect({ dialogs: dialogs.length, groups: groupMessages.length }).toEqual({ dialogs: 0, groups: 1 });

    await poller._handleGroupMessage(groupMessages[0]);

    expect(service.getChat).toHaveBeenCalledWith("500777");
    expect(service.sendChatMessage).toHaveBeenCalledWith("500777", "+7 383 233-02-03");
  });

  it("тип из самого события экономит запрос к MAX", async () => {
    const { poller, service } = buildPoller({ chat: null, rows });

    const { groupMessages } = await poller._splitByChat([
      chatEvent(900, { chat_id: "500777", chat_type: "GROUP" }),
    ]);

    expect(groupMessages).toHaveLength(1);
    expect(service.getChat).not.toHaveBeenCalled();
  });

  it("личная переписка остаётся в inbox: DIALOG группой не считается", async () => {
    const sources = [
      // реестр сказал «DIALOG» — спрашивать у MAX не нужно
      buildPoller({ chat: dialogRow, rows }),
      // в реестре чата нет, тип пришёл из события
      buildPoller({ chat: null, rows }),
      // тип дал запрос `GET /chats/{id}`
      buildPoller({ chat: null, rows, chatInfo: { type: "DIALOG" } }),
      // и вовсе неизвестен (бота в чате нет) — тоже не группа
      buildPoller({ chat: null, rows, chatInfo: null }),
    ];

    for (const [index, { poller, service, db }] of sources.entries()) {
      const chat_id = index === 0 ? dialogRow.chat_id.toString() : "500777";
      const chat_type = index === 1 ? "DIALOG" : null;

      const { dialogs, groupMessages } = await poller._splitByChat([
        chatEvent(900, { chat_id, chat_type }),
      ]);

      expect(groupMessages).toEqual([]);
      expect(dialogs).toHaveLength(1);

      await poller.persistIncoming(dialogs);

      expect(service.sendChatMessage).not.toHaveBeenCalled();
      expect(db.maxBotInboxMessage.create).toHaveBeenCalledTimes(1);
    }
  });

  it("вердикт о чате кэшируется: MAX спрашивается один раз за час", async () => {
    const { poller, service } = buildPoller({ chat: null, rows, chatInfo: { type: "CHAT" } });

    await poller._splitByChat([chatEvent(900, { chat_id: "500777" })]);
    await poller._splitByChat([chatEvent(901, { chat_id: "500777" })]);

    expect(service.getChat).toHaveBeenCalledTimes(1);
  });
});

describe("поллер MAX: отвечаем только на новые сообщения", () => {
  const rows = [replyRow(1, "телефон ук", "+7 383 233-02-03")];

  it("первый поллинг с историей чата не вызывает ни одного ответа", async () => {
    const { poller, service, state } = buildPoller({ chat: chatRow, rows });

    // Порога нет = поллер запустился впервые: MAX принёс историю чата.
    const first = await sweep(poller, [chatEvent(100), chatEvent(101)], 101);

    expect(first.fresh).toEqual([]);
    expect(first.stale).toHaveLength(2);
    expect(service.sendChatMessage).not.toHaveBeenCalled();
    expect(state.chat_reply_marker).toBe("101");
  });

  it("сообщение после порога получает ответ, а повтор уже виденного — нет", async () => {
    const { poller, service } = buildPoller({ chat: chatRow, rows, replyMarker: 101 });

    const repeated = await sweep(poller, [chatEvent(101)], 101);
    expect(repeated.stale).toHaveLength(1);
    expect(service.sendChatMessage).not.toHaveBeenCalled();

    const fresh = await sweep(poller, [chatEvent(102)], 102);
    expect(fresh.fresh).toHaveLength(1);
    expect(service.sendChatMessage).toHaveBeenCalledTimes(1);
  });

  it("событие без маркера не рассматривается: отличить его от повтора нельзя", async () => {
    const { poller, service, db } = buildPoller({ chat: chatRow, rows, replyMarker: 101 });

    const { fresh } = await sweep(poller, [chatEvent(null)], 101);

    expect(fresh).toEqual([]);
    expect(service.sendChatMessage).not.toHaveBeenCalled();
    // Порог не изменился — лишней записи в max_bot_state быть не должно.
    expect(poller.replyMarker).toBe("101");
    expect(db.maxBotState.upsert).not.toHaveBeenCalled();
  });

  it("порог переживает перезапуск: он читается из max_bot_state", async () => {
    const state = { chat_reply_marker: "101" };
    const { poller } = buildPoller({ chat: chatRow, rows, state });

    await poller._loadInitialState();

    expect(poller.replyMarker).toBe("101");

    const { stale } = await sweep(poller, [chatEvent(101)], 101);
    expect(stale).toHaveLength(1);
  });

  it("поллинг без сообщений тоже выставляет порог, и следующее сообщение получает ответ", async () => {
    const { poller, service, state } = buildPoller({ chat: chatRow, rows });

    await sweep(poller, [], 500);
    expect(state.chat_reply_marker).toBe("500");

    await sweep(poller, [chatEvent(501)], 501);
    expect(service.sendChatMessage).toHaveBeenCalledWith("500100", "+7 383 233-02-03");
  });
});

describe("админка: проверка условий и напоминаний", () => {
  const buildUseCases = ({ telegramChats = {}, maxChats = {} } = {}) => {
    const autoReplyRepository = {
      list: jest.fn(async () => []),
      getById: jest.fn(async () => null),
      findByPhrase: jest.fn(async () => null),
      create: jest.fn(async (input) => ({ id: 1n, platform: input.platform, ...input })),
      update: jest.fn(async () => ({})),
      delete: jest.fn(async () => {}),
    };
    const reminderRepository = { list: jest.fn(async () => []), getById: jest.fn(async () => null) };
    const service = new ChatAutoReplyService({ repository: autoReplyRepository, loggerImpl: logger() });

    const useCases = new ChatBotAdminUseCases({
      autoReplyRepository,
      reminderRepository,
      telegramChats,
      maxChats,
      autoReplyService: service,
      loggerImpl: logger(),
    });

    return { autoReplyRepository, reminderRepository, service, useCases };
  };

  it("фраза нормализуется, а дубликат того же канала не проходит", async () => {
    const { useCases, autoReplyRepository, service } = buildUseCases();

    // Кэш движка прогреваем заранее: правка условия должна вытеснить его сразу,
    // иначе новое правило zaczнёт действовать только через несколько секунд.
    await service.activeReplies("max");

    expect(service.cache.size).toBe(1);

    autoReplyRepository.findByPhrase.mockResolvedValueOnce({ id: 5n });

    await expect(
      useCases.createAutoReply({ platform: "max", phrase: "Телефон  УК", response: "+7 383 233-02-03" })
    ).rejects.toThrow("уже есть");

    autoReplyRepository.findByPhrase.mockResolvedValueOnce(null);

    const created = await useCases.createAutoReply({
      platform: "max",
      phrase: "Телефон  УК",
      response: " +7 383 233-02-03 ",
    });

    expect(created.phrase).toBe("телефон ук");
    expect(created.response).toBe("+7 383 233-02-03");
    expect(service.cache.size).toBe(0);
  });

  it("пустая фраза и пустой ответ не принимаются", async () => {
    const { useCases } = buildUseCases();

    await expect(useCases.createAutoReply({ platform: "max", phrase: "  ", response: "ок" })).rejects.toThrow("Пустая фраза");
    await expect(useCases.createAutoReply({ platform: "max", phrase: "ок", response: "" })).rejects.toThrow("Пустой ответ");
    await expect(useCases.createAutoReply({ platform: "sms", phrase: "ок", response: "ок" })).rejects.toThrow("Неизвестный канал");
  });

  it("напоминание можно направить только в чат, который есть в реестре и включён", async () => {
    const { useCases } = buildUseCases({
      maxChats: {
        getById: jest.fn(async (id) =>
          Number(id) === 7 ? { id: 7n, chat_id: 500100n, name: "Чат дома 39", is_active: true } : null
        ),
      },
    });

    await expect(
      useCases.createReminder({
        platform: "max",
        chatRecordId: 99,
        text: "напоминаю",
        scheduleKind: "monthly",
        timeOfDay: "10:00",
        lastDayOfMonth: true,
      })
    ).rejects.toThrow("не найден в реестре");

    const withChat = await useCases.resolveChat("max", 7);

    expect(withChat).toEqual({ chat_id: "500100", thread_id: null, name: "Чат дома 39" });
  });

  it("выключенный чат — отказ, а не молчаливая потеря напоминания", async () => {
    const { useCases } = buildUseCases({
      telegramChats: {
        getById: jest.fn(async () => ({ id: 3n, chat_id: "-100123", name: "Дом 39", is_active: false })),
      },
    });

    await expect(useCases.resolveChat("telegram", 3)).rejects.toThrow("выключен");
  });
});
