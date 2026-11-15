/* eslint-env jest */
/**
 * Ротация refresh-токена (AR-5): атомарный отзыв и детект переиспользования.
 *
 * Повторное использование отозванного токена и проигранная гонка ротации
 * гасят все сессии пользователя — украденная пара не должна жить параллельно
 * с легитимной.
 */

import { jest } from "@jest/globals";
import { RefreshTokenUseCase } from "../../../application/use-cases/user/RefreshTokenUseCase.improved.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const activeRow = (overrides = {}) => ({
  user_id: "7",
  jti: "jti-old",
  expires_at: new Date(Date.now() + 8 * DAY_MS),
  isRevoked: () => false,
  isExpired: () => false,
  ...overrides,
});

const build = () => {
  const tokenService = {
    verifyRefreshTokenSignature: jest.fn(async () => ({ id: 7, jti: "jti-old" })),
    noteDeviceMismatch: jest.fn(),
  };
  const refreshTokenRepository = {
    findByJti: jest.fn(async () => activeRow()),
    revokeIfActive: jest.fn(async () => true),
    revokeAllForUser: jest.fn(async () => {}),
  };
  const userRepository = {
    findById: jest.fn(async () => ({ user_id: 7n, isBanned: () => false })),
  };
  const sessionIssuer = {
    tokenService: { getRefreshTokenExpiration: () => 7 * 86400 },
    issue: jest.fn(async () => ({ accessToken: "a2", refreshToken: "r2", jti: "jti-new" })),
  };

  return {
    tokenService,
    refreshTokenRepository,
    sessionIssuer,
    useCase: new RefreshTokenUseCase(
      userRepository,
      tokenService,
      refreshTokenRepository,
      sessionIssuer
    ),
  };
};

describe("ротация refresh-токена", () => {
  it("успешная ротация отзывает старый jti и выдаёт новую пару", async () => {
    const { refreshTokenRepository, sessionIssuer, useCase } = build();

    const result = await useCase.execute("refresh-token", {});

    expect(refreshTokenRepository.revokeIfActive).toHaveBeenCalledWith("jti-old");
    expect(sessionIssuer.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accessToken: "a2", refreshToken: "r2" });
  });

  it("повторное использование отозванного токена гасит все сессии", async () => {
    const { refreshTokenRepository, sessionIssuer, useCase } = build();
    refreshTokenRepository.findByJti.mockResolvedValue(
      activeRow({ isRevoked: () => true })
    );

    await expect(useCase.execute("stolen-token", {})).rejects.toThrow(
      "Refresh token has been revoked"
    );

    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(7);
    expect(sessionIssuer.issue).not.toHaveBeenCalled();
  });

  it("проигранная гонка ротации гасит все сессии, а не плодит вторую", async () => {
    const { refreshTokenRepository, sessionIssuer, useCase } = build();
    refreshTokenRepository.revokeIfActive.mockResolvedValue(false);

    await expect(useCase.execute("racing-token", {})).rejects.toThrow(
      "Refresh token has been revoked"
    );

    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(7);
    expect(sessionIssuer.issue).not.toHaveBeenCalled();
  });

  it("строка сессии другого пользователя — отказ", async () => {
    const { refreshTokenRepository, useCase } = build();
    refreshTokenRepository.findByJti.mockResolvedValue(activeRow({ user_id: "999" }));

    await expect(useCase.execute("foreign-token", {})).rejects.toThrow(
      "Invalid refresh token"
    );
    expect(refreshTokenRepository.revokeIfActive).not.toHaveBeenCalled();
  });

  it("просроченная сессия не ротируется", async () => {
    const { refreshTokenRepository, useCase } = build();
    refreshTokenRepository.findByJti.mockResolvedValue(
      activeRow({ isExpired: () => true })
    );

    await expect(useCase.execute("expired-token", {})).rejects.toThrow(
      "Refresh token has expired"
    );
    expect(refreshTokenRepository.revokeIfActive).not.toHaveBeenCalled();
  });

  it("long-lived сессия наследует срок при ротации", async () => {
    const { refreshTokenRepository, sessionIssuer, useCase } = build();
    refreshTokenRepository.findByJti.mockResolvedValue(
      activeRow({ expires_at: new Date(Date.now() + 30 * DAY_MS) })
    );

    await useCase.execute("long-token", {});

    expect(sessionIssuer.issue).toHaveBeenCalledWith(
      expect.objectContaining({ rememberMe: true })
    );
  });
});