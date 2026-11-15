/* eslint-env jest */
/**
 * Двухшаговый вход через Telegram-бота (AR-1): `/start login_<id>` только
 * ставит запрос на подтверждение, сессия выдаётся после явного нажатия
 * «Подтвердить» в чате — и только тем же аккаунтом, что просил вход.
 */

import { jest } from "@jest/globals";
import { LoginHandoffUseCase } from "../../../application/use-cases/user/LoginHandoffUseCase.js";

const REQUEST_ID = "bfdcc801130747bd8f124b1680f5effd";
const tgUser = { id: 42, username: "anton", first_name: "Антон" };

const build = () => {
  const handoffs = { put: jest.fn(async () => {}), consume: jest.fn(async () => null) };
  const userRepository = { findById: jest.fn(async () => ({ user_id: 7n, telegram_id: 42 })) };
  const authenticateUserUseCase = {
    findOrCreateTelegramUser: jest.fn(async () => ({ user_id: 7n })),
  };
  const sessionIssuer = { issue: jest.fn(async () => ({ accessToken: "a", refreshToken: "r" })) };

  return {
    handoffs,
    userRepository,
    useCase: new LoginHandoffUseCase(
      userRepository,
      authenticateUserUseCase,
      sessionIssuer,
      handoffs
    ),
  };
};

describe("Telegram-бот: постановка запроса входа", () => {
  it("/start кладёт tg-confirm, но не выдаёт хендовер сессии", async () => {
    const { handoffs, useCase } = build();

    const staged = await useCase.stageForTelegramUser(tgUser, REQUEST_ID);

    expect(staged).toBe(true);
    expect(handoffs.put).toHaveBeenCalledTimes(1);
    const [args] = handoffs.put.mock.calls[0];
    expect(args.kind).toBe("tg-confirm");
    expect(args.key).toBe(REQUEST_ID);
    expect(String(args.userId)).toBe("7");
  });

  it("короткий requestId не ставится", async () => {
    const { handoffs, useCase } = build();

    expect(await useCase.stageForTelegramUser(tgUser, "777")).toBe(false);
    expect(handoffs.put).not.toHaveBeenCalled();
  });
});

describe("Telegram-бот: подтверждение входа кнопкой", () => {
  it("подтверждение тем же аккаунтом выдаёт код и requestId", async () => {
    const { handoffs, useCase } = build();
    handoffs.consume.mockResolvedValue(7n);

    const result = await useCase.confirmTelegramRequest(REQUEST_ID, tgUser);

    expect(handoffs.consume).toHaveBeenCalledWith("tg-confirm", REQUEST_ID);
    expect(result.requestId).toBe(REQUEST_ID);
    expect(result.code).toMatch(/^[0-9a-f]{64}$/);

    const kinds = handoffs.put.mock.calls.map(([args]) => args.kind);
    expect(kinds).toEqual(["tg-code", "tg-request"]);
  });

  it("чужой аккаунт не может подтвердить запрос", async () => {
    const { handoffs, useCase } = build();
    handoffs.consume.mockResolvedValue(7n);

    await expect(
      useCase.confirmTelegramRequest(REQUEST_ID, { id: 999 })
    ).rejects.toThrow("Login request belongs to another account");
    expect(handoffs.put).not.toHaveBeenCalled();
  });

  it("просроченный запрос не выдаёт сессию", async () => {
    const { handoffs, useCase } = build();
    handoffs.consume.mockResolvedValue(null);

    await expect(useCase.confirmTelegramRequest(REQUEST_ID, tgUser)).rejects.toThrow(
      "Login request not found or expired"
    );
  });

  it("отмена гасит запрос без выдачи хендовера", async () => {
    const { handoffs, useCase } = build();
    handoffs.consume.mockResolvedValue(7n);

    expect(await useCase.cancelTelegramRequest(REQUEST_ID)).toBe(true);
    expect(handoffs.consume).toHaveBeenCalledWith("tg-confirm", REQUEST_ID);
    expect(handoffs.put).not.toHaveBeenCalled();
  });
});