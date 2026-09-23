/* eslint-env jest */
/**
 * Юнит-тесты HTTP-клиента MAX Bot API. fetch полностью замокан —
 * живых запросов к боту из тестов не уходит.
 *
 * Отдельно закреплены «проверенные на live» правила:
 *  - токен только в заголовке Authorization;
 *  - 404 dialog.not.found = получатель пропущен, а не упал;
 *  - 429/5xx = повтор с задержкой.
 */

import { jest } from "@jest/globals";
import { MaxBotService, MaxBotApiError } from "../../../infrastructure/services/MaxBotService.js";

const TOKEN = "test-bot-token";

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  text: async () => JSON.stringify(body),
});

const silentLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeService = (fetchImpl, extra = {}) =>
  new MaxBotService({
    token: TOKEN,
    baseUrl: "https://max.test",
    fetchImpl,
    retryBaseDelayMs: 1,
    loggerImpl: silentLogger(),
    ...extra,
  });

describe("MaxBotService — авторизация и запросы", () => {
  it("шлёт токен только в заголовке Authorization, без токена в URL", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { payload: { user_id: 7, username: "taiginsky_bot" } }));
    const service = makeService(fetchImpl);

    const me = await service.getMe();

    expect(me).toEqual({ payload: { user_id: 7, username: "taiginsky_bot" } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://max.test/me");
    expect(init.headers.Authorization).toBe(TOKEN);
    expect(url).not.toContain(TOKEN);
  });

  it("без токена сервис не настроен и любой вызов — внятная ошибка", async () => {
    const service = new MaxBotService({ token: "", fetchImpl: jest.fn(), loggerImpl: silentLogger() });

    expect(service.isConfigured()).toBe(false);
    await expect(service.getMe()).rejects.toThrow(/MAX_BOT_TOKEN не задан/);
  });

  it("GET /updates переводит timeout из мс в секунды (лимит MAX API — 90)", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { updates: [], marker: 12 }));
    const service = makeService(fetchImpl);

    await service.getUpdates({ after: 11, timeoutMs: 3000, limit: 5 });

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe("/updates");
    expect(url.searchParams.get("after")).toBe("11");
    expect(url.searchParams.get("timeout")).toBe("3");
    expect(url.searchParams.get("limit")).toBe("5");

    await service.getUpdates({ after: 0, timeoutMs: 999999 });
    expect(fetchImpl.mock.calls[1][0]).toContain("timeout=90");
    // after=0 — валидный курсор, он должен уйти в запрос
    expect(fetchImpl.mock.calls[1][0]).toContain("after=0");
  });

  it("первый запрос без after (истории у бота нет)", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { updates: [], marker: 1 }));
    await makeService(fetchImpl).getUpdates({ timeoutMs: 1000 });

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.searchParams.has("after")).toBe(false);
  });
});

describe("MaxBotService — отправка сообщений", () => {
  it("200 = доставлено", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, { payload: { message_ids: [{ message_id: 999 }] } })
    );
    const service = makeService(fetchImpl);

    const result = await service.sendMessage("5001", "Привет, сосед");

    expect(result).toEqual({ ok: true, message_id: "999" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://max.test/messages?user_id=5001");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ text: "Привет, сосед" });
  });

  it("404 dialog.not.found = skipped, а не ошибка", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(404, { code: "dialog.not.found", message: "Dialog not found" })
    );
    const service = makeService(fetchImpl);

    const result = await service.sendMessage("5001", "Привет");

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.code).toBe("dialog.not.found");
    // диалог отсутствует — повторять не нужно
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("429 повторяется с бэкоффом и доходит до успеха", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { code: "rate.limited", message: "Too many" }))
      .mockResolvedValueOnce(jsonResponse(200, { payload: { message_ids: [] } }));

    const service = makeService(fetchImpl);
    const result = await service.sendMessage("5001", "Привет");

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("400 не повторяется и превращается в ошибку с кодом MAX", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(400, { code: "text.too.long", message: "Too long" }));
    const service = makeService(fetchImpl);

    const result = await service.sendMessage("5001", "Очень длинно");

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toMatch(/Too long/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("сетевой сбой исчерпывает повторы и бросает MaxBotApiError", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("self-signed certificate in chain");
    });
    const service = makeService(fetchImpl, { maxAttempts: 2 });

    const result = await service.sendMessage("5001", "Привет");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/сетевая ошибка/i);
  });

  it("health-путь: getMe при 5xx бросает MaxBotApiError (его ловит статус-эндпоинт)", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(503, { code: "unavailable" }));
    const service = makeService(fetchImpl, { maxAttempts: 1 });

    await expect(service.getMe()).rejects.toBeInstanceOf(MaxBotApiError);
  });

  it("пустой текст и пустой получатель не уходят в сеть", async () => {
    const fetchImpl = jest.fn();
    const service = makeService(fetchImpl);

    expect(await service.sendMessage("5001", "   ")).toMatchObject({ ok: false, skipped: false });
    expect(await service.sendMessage("", "Привет")).toMatchObject({ ok: false, skipped: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("MaxBotService — webhook", () => {
  it("POST /subscriptions шлёт url, secret и update_types", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { payload: { subscription_id: 1 } }));
    const service = makeService(fetchImpl);

    await service.subscribeWebhook("https://site.example/max-hook", "s3cret", [
      "message_created",
      "bot_started",
    ]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://max.test/subscriptions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      url: "https://site.example/max-hook",
      update_types: ["message_created", "bot_started"],
      secret: "s3cret",
    });
  });

  it("некорректный URL отклоняется до запроса", async () => {
    const fetchImpl = jest.fn();
    const service = makeService(fetchImpl);

    await expect(service.subscribeWebhook("ftp://x", "s")).rejects.toThrow(/webhook URL/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("в имени файла/логе токен не светится", async () => {
    const loggerImpl = silentLogger();
    const fetchImpl = jest.fn(async () => jsonResponse(500, { code: "boom", message: "inner failure" }));
    const service = new MaxBotService({
      token: TOKEN,
      baseUrl: "https://max.test",
      fetchImpl,
      maxAttempts: 1,
      loggerImpl,
    });

    await service.sendMessage("5001", "Привет");

    const logged = JSON.stringify(loggerImpl.error.mock.calls);
    expect(logged).not.toContain(TOKEN);
  });
});

describe("MaxBotService — резервный хост", () => {
  const networkFail = () => {
    const error = new Error("unable to get local issuer certificate");
    return Promise.reject(error);
  };

  it("при сетевом отказе уходит на резервный хост и отвечает", async () => {
    const fetchImpl = jest
      .fn()
      .mockImplementationOnce(networkFail)
      .mockImplementationOnce(async () => jsonResponse(200, { payload: { user_id: 7 } }));

    const service = makeService(fetchImpl, {
      baseUrl: "https://primary.test",
      fallbackBaseUrl: "https://backup.test",
    });

    await expect(service.getMe()).resolves.toEqual({ payload: { user_id: 7 } });
    expect(fetchImpl.mock.calls[0][0]).toContain("primary.test");
    expect(fetchImpl.mock.calls[1][0]).toContain("backup.test");
  });

  it("переключившись, остаётся на резервном хосте", async () => {
    const fetchImpl = jest
      .fn()
      .mockImplementationOnce(networkFail)
      .mockImplementation(async () => jsonResponse(200, { updates: [], marker: 3 }));

    const service = makeService(fetchImpl, {
      baseUrl: "https://primary.test",
      fallbackBaseUrl: "https://backup.test",
    });

    await service.getUpdates({ timeoutMs: 1000 });
    await service.getUpdates({ timeoutMs: 1000 });

    expect(fetchImpl.mock.calls[1][0]).toContain("backup.test");
    expect(fetchImpl.mock.calls[2][0]).toContain("backup.test");
  });

  it("явно заданный без резерва хост не подменяется", async () => {
    const fetchImpl = jest.fn(networkFail);
    const service = makeService(fetchImpl, { baseUrl: "https://only.test", fallbackBaseUrl: null });

    await expect(service.getMe()).rejects.toBeInstanceOf(MaxBotApiError);
    expect(fetchImpl.mock.calls.every(([url]) => url.includes("only.test"))).toBe(true);
  });

  it("таймаут long-poll не считается поводом менять хост", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchImpl = jest.fn().mockImplementation(() => Promise.reject(timeout));

    const service = makeService(fetchImpl, {
      baseUrl: "https://primary.test",
      fallbackBaseUrl: "https://backup.test",
    });

    await expect(service.getMe()).rejects.toThrow(/таймаут/i);
    expect(fetchImpl.mock.calls.every(([url]) => url.includes("primary.test"))).toBe(true);
  });
});
