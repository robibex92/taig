/* eslint-env jest */
/**
 * Юнит-тесты запроса подтверждения входа с сайта в чате MAX-бота (AR-1).
 *
 * Проверяется связка, а не парсер: поллер получает ответ `/updates` с событием
 * `bot_started`, зовёт кейс ПОСТАНОВКИ запроса (не выдачи сессии!) и отвечает
 * пользователю ссылкой подтверждения с одноразовым нонсом. Отдельно — что без
 * внедрённого кейса поллер остаётся просто сборщиком входящих, а сбой
 * постановки не рвёт цикл polling.
 */

import { jest } from "@jest/globals";
import { MaxBotUpdatePoller } from "../../../infrastructure/services/MaxBotUpdatePoller.js";

const ID = "bfdcc801130747bd8f124b1680f5effd";
const NONCE = "b".repeat(32);

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
  const prevApiUrl = process.env.API_URL;
  const prevFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    // Адрес API заведомо «приманка»: ссылка подтверждения обязана строиться
    // на домене сайта, бэкенд в личных сообщениях бота не светится.
    process.env.API_URL = "https://api.example.test/api-v1";
    process.env.FRONTEND_URL = "https://infojk.ru";
  });

  afterEach(() => {
    if (prevApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = prevApiUrl;
    if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = prevFrontendUrl;
  });

  it("ставит запрос на подтверждение и шлёт ссылку на страницу сайта с нонсом, а не выдаёт сессию", async () => {
    const stageLoginFromBotUser = jest.fn(async () => ({ staged: true, nonce: NONCE }));
    const service = { sendMessage: jest.fn(async () => ({ ok: true, message_id: "1" })) };
    const poller = buildPoller({ loginConfirmation: { stageLoginFromBotUser }, service });

    await poller._processLoginRequests({ updates: [startedUpdate] });

    expect(stageLoginFromBotUser).toHaveBeenCalledWith(
      { id: "123", username: "anton", first_name: "Антон" },
      ID
    );

    const text = service.sendMessage.mock.calls[0][1];
    expect(text).toContain("Запрос входа на сайт");
    expect(text).toContain(`https://infojk.ru/#/max-confirm?r=${ID}&t=${NONCE}`);
    expect(text).not.toContain("api.example.test");
    // Сессия на этом шаге не выдаётся: ссылки с кодом входа в сообщении нет.
    expect(text).not.toContain("max_login=");
  });

  it("ссылка строится даже без API_URL: подтверждение живёт на сайте", async () => {
    delete process.env.API_URL;
    const service = { sendMessage: jest.fn(async () => ({ ok: true, message_id: "1" })) };
    const poller = buildPoller({
      service,
      loginConfirmation: {
        stageLoginFromBotUser: jest.fn(async () => ({ staged: true, nonce: NONCE })),
      },
    });

    await poller._processLoginRequests({ updates: [startedUpdate] });

    const text = service.sendMessage.mock.calls[0][1];
    expect(text).toContain(`/#/max-confirm?r=${ID}&t=${NONCE}`);
  });

  it("неподтверждённый запрос не получает ссылки", async () => {
    const service = { sendMessage: jest.fn(async () => ({ ok: true, message_id: "1" })) };
    const poller = buildPoller({
      service,
      loginConfirmation: {
        stageLoginFromBotUser: jest.fn(async () => ({ staged: false, nonce: null })),
      },
    });

    await poller._processLoginRequests({ updates: [startedUpdate] });

    const text = service.sendMessage.mock.calls[0][1];
    expect(text).toContain("не подошёл");
    expect(text).not.toContain("/max-confirm");
  });

  it("молчит, если кейс подтверждения не внедрён", async () => {
    const service = { sendMessage: jest.fn() };

    await buildPoller({ service })._processLoginRequests({ updates: [startedUpdate] });

    expect(service.sendMessage).not.toHaveBeenCalled();
  });

  it("сбой постановки не рвёт цикл и не отвечает в чат", async () => {
    const service = { sendMessage: jest.fn() };
    const poller = buildPoller({
      service,
      loginConfirmation: {
        stageLoginFromBotUser: jest.fn(async () => {
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
    const poller = buildPoller({ loginConfirmation: { stageLoginFromBotUser: jest.fn() } });

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