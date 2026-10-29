/* eslint-env jest */
/**
 * Что именно кладется в `auth_handoffs`, когда вход подтвердили в чате MAX-бота.
 *
 * С 26.10 подтверждение даёт не только `requestId` для опроса вкладки сайта, но и
 * одноразовый `code` для ссылки `?max_login=` — без неё вход на телефоне
 * доживает только пока вкладка не уснула.
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

describe("подтверждение входа в чате MAX", () => {
  it("кладёт и requestId, и одноразовый код для ссылки", async () => {
    const { handoffs, useCase } = build();

    const result = await useCase.confirmLoginFromBotUser(maxUser, REQUEST_ID);

    expect(result.confirmed).toBe(true);
    expect(result.code).toMatch(/^[0-9a-f]{64}$/);

    const kinds = handoffs.put.mock.calls.map(([args]) => args.kind);
    expect(kinds).toEqual(["request", "code"]);

    const codeRow = handoffs.put.mock.calls.find(([args]) => args.kind === "code")[0];
    expect(codeRow.key).toBe(result.code);
    expect(String(codeRow.userId)).toBe("5");
    expect(codeRow.ttlMs).toBe(5 * 60 * 1000);
  });

  it("слишком короткий requestId не порождает ни хендовера, ни кода", async () => {
    const { handoffs, useCase } = build();

    // Правило то же, что у Telegram-бота: `{8,64}`, «login_777» сюда не годится.
    const result = await useCase.confirmLoginFromBotUser(maxUser, "777");

    expect(result.confirmed).toBe(false);
    expect(result.code).toBeNull();
    expect(handoffs.put).not.toHaveBeenCalled();
  });
});
