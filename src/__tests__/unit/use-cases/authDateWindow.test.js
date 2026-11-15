/* eslint-env jest */
/**
 * Окно auth_date Telegram-виджета (AR-7): дата из будущего дальше допуска
 * часов не должна проходить бессрочно.
 */

import { jest } from "@jest/globals";
import { AuthenticateUserUseCase } from "../../../application/use-cases/user/AuthenticateUserUseCase.improved.js";

const build = () =>
  new AuthenticateUserUseCase({}, { issue: jest.fn() });

describe("isAuthDateValid (Telegram-виджет)", () => {
  const now = () => Math.floor(Date.now() / 1000);

  it("свежая дата проходит", () => {
    expect(build().isAuthDateValid(now() - 60)).toBe(true);
  });

  it("небольшой перекос часов в будущее допускается", () => {
    expect(build().isAuthDateValid(now() + 30)).toBe(true);
  });

  it("дата из будущего дальше допуска отвергается", () => {
    expect(build().isAuthDateValid(now() + 3600)).toBe(false);
  });

  it("протухшая дата отвергается", () => {
    expect(build().isAuthDateValid(now() - 7200)).toBe(false);
  });

  it("нечисловая дата отвергается", () => {
    const useCase = build();
    expect(useCase.isAuthDateValid("123")).toBe(false);
    expect(useCase.isAuthDateValid(NaN)).toBe(false);
    expect(useCase.isAuthDateValid(undefined)).toBe(false);
  });
});