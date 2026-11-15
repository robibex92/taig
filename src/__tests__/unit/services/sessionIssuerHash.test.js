/* eslint-env jest */
/**
 * В `refresh_tokens` уходит sha256 refresh-токена, а не сам токен (AR-4):
 * утечка дампа не даёт готовых рабочих сессий.
 */

import crypto from "crypto";
import { jest } from "@jest/globals";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret";

const { TokenService } = await import(
  "../../../application/services/TokenService.improved.js"
);
const { SessionIssuer } = await import(
  "../../../application/services/SessionIssuer.js"
);

// `user_id` числом: глобальный BigInt-toJSON живёт в server.js, который в
// юнит-тесте не загружен (так же сделано в sessionRevocation.test.js).
const user = { user_id: 7, isBanned: () => false, toJSON: () => ({ user_id: 7 }) };

describe("SessionIssuer: хранение refresh-токена", () => {
  it("в БД кладётся sha256, сам токен — только в ответе", async () => {
    const create = jest.fn(async () => {});
    const tokenService = new TokenService();
    const issuer = new SessionIssuer(tokenService, { create });

    const session = await issuer.issue({ user, deviceInfo: {}, rememberMe: false });

    expect(create).toHaveBeenCalledTimes(1);
    const row = create.mock.calls[0][0];

    const expectedHash = crypto
      .createHash("sha256")
      .update(session.refreshToken)
      .digest("hex");

    expect(row.token).toBe(expectedHash);
    expect(row.token).not.toBe(session.refreshToken);
    expect(row.jti).toBe(session.jti);
  });
});