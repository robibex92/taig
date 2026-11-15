/* eslint-env jest */
/**
 * Двухшаговый вход через чат MAX-бота (AR-1).
 *
 * Шаг 1 (`stageLoginFromBotUser`): событие бота только ставит запрос на
 * подтверждение (`max-confirm` с нонсом) — сессия не выдаётся, потому что
 * ссылку на бота мог прислать кто угодно.
 * Шаг 2 (`confirmStagedLogin`): переход по ссылке из чата гасит нонс и кладёт
 * обычные хендоверы — `request` для опроса вкладки и `code` для ссылки
 * `?max_login=`.
 */

import { jest } from "@jest/globals";
import { AuthenticateMaxUserUseCase } from "../../../application/use-cases/user/AuthenticateMaxUserUseCase.js";

const REQUEST_ID = "bfdcc801130747bd8f124b1680f5effd";

const maxUser = { id: 123, username: "anton", first_name: "Антон" };

const build = () => {
  const handoffs = { put: jest.fn(async () => {}), consume: jest.fn(async () => null) };
  const userRepository = {
    findByMaxId: jest.fn(async () => ({ user_id: 5n })),
    update: jest.fn(async () => {}),
    findById: jest.fn(async () => ({ user_id: 5n })),
    create: jest.fn(),
  };

  return {
    handoffs,
    useCase: new AuthenticateMaxUserUseCase(userRepository, { issue: jest.fn() }, handoffs),
  };
};

describe("постановка запроса входа в чате MAX", () => {
  it("кладёт max-confirm с нонсом и не выдаёт хендовер сессии", async () => {
    const { handoffs, useCase } = build();

    const { staged, nonce } = await useCase.stageLoginFromBotUser(maxUser, REQUEST_ID);

    expect(staged).toBe(true);
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);

    expect(handoffs.put).toHaveBeenCalledTimes(1);
    const [args] = handoffs.put.mock.calls[0];
    expect(args.kind).toBe("max-confirm");
    expect(args.key).toBe(`${REQUEST_ID}:${nonce}`);
    expect(String(args.userId)).toBe("5");
    expect(args.ttlMs).toBe(5 * 60 * 1000);
  });

  it("слишком короткий requestId не порождает запроса", async () => {
    const { handoffs, useCase } = build();

    // Правило то же, что у Telegram-бота: `{8,64}`, «login_777» сюда не годится.
    const { staged, nonce } = await useCase.stageLoginFromBotUser(maxUser, "777");

    expect(staged).toBe(false);
    expect(nonce).toBeNull();
    expect(handoffs.put).not.toHaveBeenCalled();
  });
});

describe("подтверждение входа по ссылке из чата MAX", () => {
  it("гасит нонс и кладёт requestId и одноразовый код", async () => {
    const { handoffs, useCase } = build();
    const nonce = "c".repeat(32);
    handoffs.consume.mockResolvedValue(5n);

    const result = await useCase.confirmStagedLogin(REQUEST_ID, nonce);

    expect(handoffs.consume).toHaveBeenCalledWith("max-confirm", `${REQUEST_ID}:${nonce}`);
    expect(result.confirmed).toBe(true);
    expect(result.code).toMatch(/^[0-9a-f]{64}$/);

    const kinds = handoffs.put.mock.calls.map(([args]) => args.kind);
    expect(kinds).toEqual(["request", "code"]);

    const codeRow = handoffs.put.mock.calls.find(([args]) => args.kind === "code")[0];
    expect(codeRow.key).toBe(result.code);
    expect(String(codeRow.userId)).toBe("5");
  });

  it("просроченный или чужой нонс не выдаёт сессию", async () => {
    const { handoffs, useCase } = build();
    handoffs.consume.mockResolvedValue(null);

    await expect(useCase.confirmStagedLogin(REQUEST_ID, "c".repeat(32))).rejects.toThrow(
      "Login request not found or expired"
    );
    expect(handoffs.put).not.toHaveBeenCalled();
  });

  it("невалидный нонс отвергается до похода в хранилище", async () => {
    const { handoffs, useCase } = build();

    await expect(useCase.confirmStagedLogin(REQUEST_ID, "not-a-nonce")).rejects.toThrow(
      "Invalid MAX login confirmation"
    );
    expect(handoffs.consume).not.toHaveBeenCalled();
  });
});