/* eslint-env jest */
/**
 * AR-18: если выдача сессии упала уже после consume, хендовер возвращается
 * на место — пользователю не нужно начинать вход заново из-за сбоя БД.
 */

import { jest } from "@jest/globals";
import { LoginHandoffUseCase } from "../../../application/use-cases/user/LoginHandoffUseCase.js";
import { AuthenticateMaxUserUseCase } from "../../../application/use-cases/user/AuthenticateMaxUserUseCase.js";

const REQUEST_ID = "bfdcc801130747bd8f124b1680f5effd";

describe("компенсация хендовера при сбое выдачи сессии", () => {
  it("Telegram claim: сбой issue возвращает tg-request на место", async () => {
    const handoffs = { put: jest.fn(async () => {}), consume: jest.fn(async () => 7n) };
    const userRepository = { findById: jest.fn(async () => ({ user_id: 7n })) };
    const sessionIssuer = {
      issue: jest.fn(async () => {
        throw new Error("db down");
      }),
    };
    const useCase = new LoginHandoffUseCase(userRepository, {}, sessionIssuer, handoffs);

    await expect(useCase.claim({ requestId: REQUEST_ID })).rejects.toThrow("db down");

    expect(handoffs.put).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "tg-request", key: REQUEST_ID, userId: 7n })
    );
  });

  it("MAX claim по requestId: сбой issue возвращает request на место", async () => {
    const handoffs = { put: jest.fn(async () => {}), consume: jest.fn(async () => 7n) };
    const userRepository = { findById: jest.fn(async () => ({ user_id: 7n })) };
    const sessionIssuer = {
      issue: jest.fn(async () => {
        throw new Error("db down");
      }),
    };
    const useCase = new AuthenticateMaxUserUseCase(userRepository, sessionIssuer, handoffs);

    await expect(useCase.claimLoginRequest(REQUEST_ID)).rejects.toThrow("db down");

    expect(handoffs.put).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "request", key: REQUEST_ID, userId: 7n })
    );
  });

  it("MAX claim по коду: сбой issue возвращает code на место", async () => {
    const code = "c".repeat(64);
    const handoffs = { put: jest.fn(async () => {}), consume: jest.fn(async () => 7n) };
    const userRepository = { findById: jest.fn(async () => ({ user_id: 7n })) };
    const sessionIssuer = {
      issue: jest.fn(async () => {
        throw new Error("db down");
      }),
    };
    const useCase = new AuthenticateMaxUserUseCase(userRepository, sessionIssuer, handoffs);

    await expect(useCase.claimLoginCode(code)).rejects.toThrow("db down");

    expect(handoffs.put).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "code", key: code, userId: 7n })
    );
  });

  it("успешный claim ничего не возвращает в хранилище", async () => {
    const handoffs = { put: jest.fn(async () => {}), consume: jest.fn(async () => 7n) };
    const userRepository = { findById: jest.fn(async () => ({ user_id: 7n })) };
    const sessionIssuer = { issue: jest.fn(async () => ({ accessToken: "a" })) };
    const useCase = new LoginHandoffUseCase(userRepository, {}, sessionIssuer, handoffs);

    await useCase.claim({ requestId: REQUEST_ID });

    expect(handoffs.put).not.toHaveBeenCalled();
  });
});