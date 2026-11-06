/* eslint-env jest */
/**
 * Заблокированный аккаунт.
 *
 * Блокировка (`global:blocked`) работала только там, где маршрут стоял под
 * `authorize()`/`requireRoles`, то есть в админке. Обычные маршруты
 * (`authenticateJWT`) заблокированный проходил как любой житель, а
 * `authenticateOptional` распознавал его как staff — со доступом к данным жильца
 * в паркинге и к снятым объявлениям.
 */

import { jest, describe, it, expect } from "@jest/globals";

const rows = {};
const userRepo = { findById: async (id) => rows[String(id)] ?? null };
const tokenService = {
  verifyToken: () => ({ id: 7 }),
  extractDeviceInfo: () => "fp",
};

await jest.unstable_mockModule(
  "../../../infrastructure/repositories/UserRepository.js",
  () => ({ default: userRepo })
);
await jest.unstable_mockModule(
  "../../../infrastructure/container/Container.js",
  () => ({ container: { resolve: () => tokenService } })
);

const { authenticateJWT, authenticateOptional } = await import(
  "../../../presentation/middlewares/authMiddleware.js"
);

const respond = () => ({ json: () => {}, status: () => ({ json: () => {} }) });

const run = (middleware) =>
  new Promise((resolve, reject) => {
    middleware({ headers: { authorization: "Bearer x" } }, respond(), (error) =>
      error ? reject(error) : resolve()
    );
  });

/** Мидлвэр пишет идентичность в тот же `req`, который ему дали. */
const runOn = async (middleware, user) => {
  const req = { headers: { authorization: "Bearer x" } };
  await new Promise((resolve, reject) => {
    middleware(req, respond(), (error) => (error ? reject(error) : resolve()));
  });
  return req;
};

describe("authenticateJWT", () => {
  it("обычного жителя пропускает", async () => {
    rows["7"] = { user_id: 7n, roles: [], username: "neighbour" };

    const req = await runOn(authenticateJWT);

    expect(req.user.user_id).toBe(7n);
  });

  it("заблокированному — 403, а не обычный вход", async () => {
    rows["7"] = { user_id: 7n, roles: ["global:blocked"] };

    const error = await run(authenticateJWT).catch((e) => e);

    expect(error.statusCode ?? error.status).toBe(403);
    expect(error.message).toBe("Аккаунт заблокирован");
  });
});

describe("authenticateOptional", () => {
  it("модерация получает свой профиль", async () => {
    rows["7"] = { user_id: 7n, roles: ["global:moderator"] };

    const req = await runOn(authenticateOptional);

    expect(req.user.roles).toEqual(["global:moderator"]);
  });

  it("заблокированный модератор — гость", async () => {
    rows["7"] = { user_id: 7n, roles: ["global:moderator", "global:blocked"] };

    const req = await runOn(authenticateOptional);

    expect(req.user).toBeNull();
  });

  it("без токена — гость", async () => {
    const req = { headers: {} };

    await new Promise((resolve) => authenticateOptional(req, respond(), resolve));

    expect(req.user).toBeNull();
  });
});
