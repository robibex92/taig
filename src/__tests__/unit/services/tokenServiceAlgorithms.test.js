/* eslint-env jest */
/**
 * Алгоритм подписи токена зафиксирован.
 *
 * Без явного списка `algorithms` jsonwebtoken доверяет алгоритму из заголовка
 * самого токена: при симметрическом секрете это позволяет подменить, например,
 * HS512 вместо HS256. Проверка построена на настоящих подписанных токенах, а не
 * на mock-е верификатора.
 */

import jwt from "jsonwebtoken";
import { TokenService } from "../../../application/services/TokenService.improved.js";

const SECRET = "test-access-secret";
const ISSUER = "taiginsky-api";
const AUDIENCE = "taiginsky-app";

const buildService = () => {
  process.env.JWT_ACCESS_SECRET = SECRET;
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.JWT_ACCESS_EXPIRATION = "15m";
  return new TokenService();
};

const user = { user_id: 42 };
const device = { ua: "jest" };

/** Подпись тем же секретом, но с другим алгоритмом или без алгоритма. */
const tampered = (service, options) =>
  jwt.sign(
    { id: 42, type: "access", device: service.hashDeviceInfo(device) },
    SECRET,
    { issuer: ISSUER, audience: AUDIENCE, expiresIn: "15m", ...options }
  );

describe("TokenService: алгоритмы", () => {
  it("принимает токен, который сам же подписывает (HS256)", async () => {
    const service = buildService();
    const token = service.generateAccessToken(user, device);

    expect((await service.verifyToken(token, device)).id).toBe(42);
  });

  it("отклоняет токен с другим алгоритмом той же подписи", async () => {
    const service = buildService();

    await expect(service.verifyToken(tampered(service, { algorithm: "HS512" }), device)).rejects.toThrow();
  });

  it("отклоняет токен без алгоритма (alg: none)", async () => {
    const service = buildService();

    // `algorithm: "none"` jsonwebtoken принимает только при пустом секрете,
    // поэтому здесь именно подпись «без алгоритма».
    await expect(service.verifyToken(tampered(service, { algorithm: "none" }), device)).rejects.toThrow();
  });

  it("refresh-токен не проходит как access", async () => {
    const service = buildService();
    const refresh = service.generateRefreshToken(user, device);

    await expect(service.verifyAccessToken(refresh, device)).rejects.toThrow();
  });

  it("синхронная проверка подписи тоже требует HS256", () => {
    const service = buildService();

    expect(() =>
      service.verifyAccessTokenSignature(tampered(service, { algorithm: "HS512" }))
    ).toThrow();
    expect(service.verifyAccessTokenSignature(service.generateAccessToken(user, device)).id).toBe(42);
  });
});
