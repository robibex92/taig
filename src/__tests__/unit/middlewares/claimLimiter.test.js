/* eslint-env jest */
/**
 * Квота на обмен одноразового handoff-кода на сессию.
 *
 * Важно не то, что limiter вообще существует, а его семантика на этом маршруте:
 * сайт во время входа опрашивает `claim` каждые 2,5 с и до подтверждения бота
 * получает 401. Если считать и успешные ответы — легитимный вход выгорает сам;
 * если не считать ничего — перебивается перебор чужих requestId.
 */

import express from "express";
import request from "supertest";
import { makeClaimLimiter } from "../../../presentation/middlewares/securityMiddleware.js";

const buildApp = (max) => {
  const app = express();
  app.use(express.json());
  app.post("/probe", makeClaimLimiter(max), (_req, res) => {
    if (_req.query.ok === "1") return res.json({ success: true });
    res.status(401).json({ error: { message: "Login request not found or expired" } });
  });
  return app;
};

describe("claimLimiter", () => {
  it("считает только неудачные попытки и на четвёртой отдаёт 429", async () => {
    const app = buildApp(3);
    const statuses = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await request(app).post("/probe").send({ requestId: "x" })).status);
    }

    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses[3]).toBe(429);
  });

  it("успешный обмен не сжигает бюджет неудач", async () => {
    const app = buildApp(3);

    // Три неудачи — лимит ещё не исчерпан (считаются только они), затем три
    // успешных обмена подряд. Если бы успехи тоже засчитывались, четвёртый
    // запрос уже упёрся бы в 429.
    const statuses = [];
    statuses.push((await request(app).post("/probe").send({ requestId: "x" })).status);
    statuses.push((await request(app).post("/probe?ok=1").send({ requestId: "y" })).status);
    statuses.push((await request(app).post("/probe?ok=1").send({ requestId: "y" })).status);
    statuses.push((await request(app).post("/probe?ok=1").send({ requestId: "y" })).status);
    statuses.push((await request(app).post("/probe").send({ requestId: "z" })).status);

    expect(statuses).toEqual([401, 200, 200, 200, 401]);
  });

  it("отдаёт внятный код ошибки, а не голый текст", async () => {
    const app = buildApp(1);

    await request(app).post("/probe").send({ requestId: "x" });
    const blocked = await request(app).post("/probe").send({ requestId: "x" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("CLAIM_RATE_LIMIT_EXCEEDED");
  });
});
