/* eslint-env jest */
/**
 * Отзыв сессии (аудит 06.11, S17).
 *
 * Отозванный access-токен раньше лежал в `Set` памяти процесса: второй воркер
 * PM2 его не видел, а после рестарта не не видел никто — «выйти из аккаунта»
 * означало «перестать быть допущенным через 15 минут». Теперь отзыв читается
 * из строки `refresh_tokens` по общему для пары `jti`.
 */

import jwt from "jsonwebtoken";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret";

const { TokenService } = await import(
  "../../../application/services/TokenService.improved.js"
);

// `user_id` в payload: на проде это BigInt, который спасает только глобальный
// `toJSON` из `server.js` (в тесте сервер не загружен), поэтому числом.
const user = { user_id: 7 };

const sessions = new Map();
const sessionStore = {
  findByJti: async (jti) => sessions.get(jti) ?? null,
  revokeByJti: async (jti) => {
    const row = sessions.get(jti);
    if (!row) return 0;
    row.is_revoked = true;
    return 1;
  },
};

const issued = (service) => {
  const pair = service.generateTokenPair(user, { userAgent: "ua", acceptLanguage: "ru" });

  sessions.set(pair.jti, { jti: pair.jti, is_revoked: false });

  return pair;
};

describe("одна сессия на пару токенов", () => {
  const service = new TokenService(sessionStore);

  it("access и refresh несут один `jti`", () => {
    const { accessToken, refreshToken, jti } = service.generateTokenPair(user);

    expect(service.decodeToken(accessToken).jti).toBe(jti);
    expect(service.decodeToken(refreshToken).jti).toBe(jti);
  });

  it("access без хранилища сессий проверяется как раньше", async () => {
    const plain = new TokenService();
    const token = plain.generateAccessToken(user);

    await expect(plain.verifyAccessToken(token)).resolves.toMatchObject({ type: "access" });
  });
});

describe("отзыв", () => {
  const service = new TokenService(sessionStore);

  it("после `revokeToken` не принимает ни access, ни refresh этой пары", async () => {
    const { accessToken, refreshToken, jti } = issued(service);

    await expect(service.verifyAccessToken(accessToken)).resolves.toBeTruthy();

    await service.revokeToken(accessToken);

    await expect(service.verifyAccessToken(accessToken)).rejects.toMatchObject({
      message: "Token has been revoked",
    });
    await expect(service.verifyRefreshToken(refreshToken)).rejects.toMatchObject({
      message: "Refresh token has been revoked",
    });
    expect(sessions.get(jti).is_revoked).toBe(true);
  });

  it("отозвать можно и по refresh-токену: `jti` общий", async () => {
    const { accessToken, refreshToken } = issued(service);

    await service.revokeToken(refreshToken);

    await expect(service.verifyAccessToken(accessToken)).rejects.toBeInstanceOf(Error);
  });

  it("«новый рестарт процесса» видит отзыв: состояние в хранилище, а не в памяти", async () => {
    const { accessToken } = issued(service);
    await service.revokeToken(accessToken);

    // Второй инстанс сервиса с тем же хранилищем — это и есть второй воркер PM2.
    const secondWorker = new TokenService(sessionStore);

    await expect(secondWorker.verifyAccessToken(accessToken)).rejects.toMatchObject({
      message: "Token has been revoked",
    });
  });

  it("сессии, которой нет в таблице, не мешает (токены до миграции)", async () => {
    const token = service.generateAccessToken(user);

    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({ type: "access" });
  });

  it("сбой хранилища не роняет авторизацию, но и не открывает доступ мимо подписи", async () => {
    const broken = new TokenService({
      findByJti: async () => {
        throw new Error("connection reset");
      },
    });
    const token = broken.generateAccessToken(user);

    await expect(broken.verifyAccessToken(token)).resolves.toBeTruthy();

    const forged = jwt.sign({ id: 7, type: "access" }, "chuzhoj-sekret", {
      issuer: "taiginsky-api",
      audience: "taiginsky-app",
    });

    await expect(broken.verifyAccessToken(forged)).rejects.toBeInstanceOf(Error);
  });

  it("синхронная проверка подписи не ходит в хранилище — для ключа лимитера", () => {
    const { accessToken, jti } = issued(service);

    expect(service.verifyAccessTokenSignature(accessToken).id).toBe(7);

    sessions.get(jti).is_revoked = true;

    // Лимитеру всё равно, отозвана ли сессия: ему важно, чей это запрос.
    expect(() => service.verifyAccessTokenSignature(accessToken)).not.toThrow();
  });
});
