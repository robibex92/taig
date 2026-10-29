/* eslint-env jest */
/**
 * Юнит-тесты подтверждения входа с сайта в чате MAX-бота.
 *
 * Проверяется связка, а не парсер: поллер получает ответ `/updates` с событием
 * `bot_started`, зовёт кейс привязки и отвечает пользователю. Отдельно — что без
 * внедрённого кейса поллер остаётся просто сборщиком входящих, а сбой подтверждения
 * не рвёт цикл polling.
 */

import { jest } from "@jest/globals";
import { MaxBotUpdatePoller } from "../../../infrastructure/services/MaxBotUpdatePoller.js";

const ID = "bfdcc801130747bd8f124b1680f5effd";
const CODE = "a".repeat(64);

const startedUpdate = {
  update_type: "bot_started",
  payload: `login_${ID}`,
  user: { user_id: 123, username: "anton", first_name: "Антон" },
  chat_id: 555,
  marker: 900,
};

const fakeLog = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const buildPoller = ({ loginConfirmation = null, service } = {}) =>
  new MaxBotUpdatePoller({
    db: {},
    service: service ?? { sendMessage: jest.fn(async () => ({ ok: true, message_id: "1" })) },
    loggerImpl: fakeLog(),
    loginConfirmation,
  });

describe("MaxBotUpdatePoller: вход с сайта", () => {
  it("привязывает автора события к requestId и отвечает в чат ссылкой с кодом", async () => {
    const confirmLoginFromBotUser = jest.fn(async () => ({
      user_id: 5n,
      confirmed: true,
      code: CODE,
    }));
    const service = { sendMessage: jest.fn(async () => ({ ok: true, message_id: "1" })) };
    const poller = buildPoller({ loginConfirmation: { confirmLoginFromBotUser }, service });

    await poller._processLoginRequests({ updates: [startedUpdate] });

    expect(confirmLoginFromBotUser).toHaveBeenCalledWith(
      { id: "123", username: "anton", first_name: "Антон" },
      ID
    );

    const text = service.sendMessage.mock.calls[0][1];
    expect(text).toContain("Вход подтверждён");
    // Ссылка с `?max_login=` — то, что делает вход независимым от вкладки сайта.
    expect(text).toContain(`/?max_login=${CODE}`);
  });

  it("без кода отвечает старой формулировкой и без ссылки", async () => {
    const service = { sendMessage: jest.fn(async () => ({ ok: true, message_id: "1" })) };
    const poller = buildPoller({
      service,
      loginConfirmation: {
        confirmLoginFromBotUser: jest.fn(async () => ({ user_id: 5n, confirmed: true, code: null })),
      },
    });

    await poller._processLoginRequests({ updates: [startedUpdate] });

    const text = service.sendMessage.mock.calls[0][1];
    expect(text).toContain("Вернитесь во вкладку сайта");
    expect(text).not.toContain("max_login");
  });

  it("неподтверждённый запрос не получает ни кода, ни ссылки", async () => {
    const service = { sendMessage: jest.fn(async () => ({ ok: true, message_id: "1" })) };
    const poller = buildPoller({
      service,
      loginConfirmation: {
        confirmLoginFromBotUser: jest.fn(async () => ({
          user_id: 5n,
          confirmed: false,
          code: null,
        })),
      },
    });

    await poller._processLoginRequests({ updates: [startedUpdate] });

    const text = service.sendMessage.mock.calls[0][1];
    expect(text).toContain("не подошёл");
    expect(text).not.toContain("max_login");
  });

  it("молчит, если кейс подтверждения не внедрён", async () => {
    const service = { sendMessage: jest.fn() };

    await buildPoller({ service })._processLoginRequests({ updates: [startedUpdate] });

    expect(service.sendMessage).not.toHaveBeenCalled();
  });

  it("сбой привязки не рвёт цикл и не отвечает в чат", async () => {
    const service = { sendMessage: jest.fn() };
    const poller = buildPoller({
      service,
      loginConfirmation: {
        confirmLoginFromBotUser: jest.fn(async () => {
          throw new Error("auth_handoffs недоступна");
        }),
      },
    });

    await expect(poller._processLoginRequests({ updates: [startedUpdate] })).resolves.toBeUndefined();

    expect(service.sendMessage).not.toHaveBeenCalled();
    expect(poller.log.error).toHaveBeenCalledWith(
      "MAX-бот: вход с сайта не подтверждён",
      expect.objectContaining({ max_user_id: "123" })
    );
  });

  it("сообщает имена ключей start-события, где параметр не нашёлся", async () => {
    const poller = buildPoller({ loginConfirmation: { confirmLoginFromBotUser: jest.fn() } });

    await poller._processLoginRequests({
      updates: [{ update_type: "bot_started", user: { user_id: 1 }, some_other_form: "abcdef" }],
    });

    const logged = poller.log.info.mock.calls.find(
      ([message]) => message === "MAX-бот: start-событие без параметра входа"
    );

    expect(logged).toBeDefined();
    expect(JSON.stringify(logged[1])).not.toContain(ID);
  });
});
