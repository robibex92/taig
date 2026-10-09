/* eslint-env jest */
/**
 * Юнит-тесты чтения входа с сайта из событий MAX-бота.
 *
 * Форма документирована так: диплом-ссылка `https://max.ru/<bot>?start=<payload>`,
 * бот получает `{ update_type: "bot_started", payload: "<payload>", user: {...},
 * chat_id }`. Проверено на этой форме и на вариациях, которые MAX исторически
 * присылает вложенно (`data.payload`, `user_id` вместо `id`), плюс на том, чего
 * делать нельзя: чужое слово `login_…` в тексте сообщения не должно становиться
 * подтверждением входа, а событие от самого бота — вообще учитываться.
 */

import { extractMaxLoginRequests } from "../../../core/utils/maxBotEvents.js";

const BOT_ID = "777";
const ID = "login_bfdcc801130747bd8f124b1680f5effd";

const started = (over = {}) => ({
  update_type: "bot_started",
  payload: ID,
  user: { user_id: 123, username: "anton", first_name: "Антон" },
  chat_id: 555,
  marker: 900,
  ...over,
});

describe("extractMaxLoginRequests: bot_started", () => {
  it("берёт автора и requestId из документированной формы", () => {
    const { requests, observed } = extractMaxLoginRequests(
      { updates: [started()], marker: 900 },
      { botUserId: BOT_ID }
    );

    expect(requests).toEqual([
      {
        max_user_id: "123",
        request_id: "bfdcc801130747bd8f124b1680f5effd",
        marker: "900",
        display_name: "Антон",
        username: "anton",
        source: "bot_started",
      },
    ]);

    // Распознанное событие в `observed` не попадает: там только неизвестные формы.
    expect(observed).toEqual([]);
  });

  it("пишет имена ключей start-события, где параметр не нашёлся", () => {
    const { requests, observed } = extractMaxLoginRequests(
      { updates: [{ update_type: "bot_started", user: { user_id: 123 }, chat_id: 5, some_other_form: "abcdef" }] },
      { botUserId: BOT_ID }
    );

    // Значение параметра не уезжает в диагностику — только имена ключей.
    expect(requests).toHaveLength(0);
    expect(observed).toEqual([
      { update_type: "bot_started", keys: ["chat_id", "some_other_form", "update_type", "user"] },
    ]);
  });

  it("читает вложенные варианты и `id` вместо `user_id`", () => {
    const nested = extractMaxLoginRequests(
      { events: [{ update_type: "bot_started", data: { payload: ID }, user: { id: 42, first_name: "Я" } }] },
      { botUserId: BOT_ID }
    );

    expect(nested.requests).toHaveLength(1);
    expect(nested.requests[0].max_user_id).toBe("42");
  });

  it("игнорирует событие без start-параметра и слишком короткий код", () => {
    const empty = extractMaxLoginRequests(
      { updates: [started({ payload: undefined })] },
      { botUserId: BOT_ID }
    );
    const short = extractMaxLoginRequests({ updates: [started({ payload: "login_777" })] }, {
      botUserId: BOT_ID,
    });

    expect(empty.requests).toEqual([]);
    expect(short.requests).toEqual([]);
  });

  it("не считает событием входа запуск самого бота", () => {
    const byBot = extractMaxLoginRequests(
      { updates: [started({ user: { user_id: Number(BOT_ID), is_bot: true } })] },
      { botUserId: BOT_ID }
    );

    expect(byBot.requests).toEqual([]);
  });
});

describe("extractMaxLoginRequests: сообщения", () => {
  const message = (text, over = {}) => ({
    update_type: "message_created",
    message: { text, user_id: 123 },
    ...over,
  });

  it("ловит `/start login_…` из текста пользователя", () => {
    const { requests } = extractMaxLoginRequests({ updates: [message(`/start ${ID}`)] }, {
      botUserId: BOT_ID,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].source).toBe("message");
  });

  it("не ищет код в незнакомых полях сообщения", () => {
    const { requests } = extractMaxLoginRequests(
      { updates: [message("привет", { attachments: [{ caption: ID }] })] },
      { botUserId: BOT_ID }
    );

    expect(requests).toEqual([]);
  });

  it("дедупицирует повторную доставку того же события", () => {
    const { requests } = extractMaxLoginRequests(
      { updates: [started(), started()] },
      { botUserId: BOT_ID }
    );

    expect(requests).toHaveLength(1);
  });
});
