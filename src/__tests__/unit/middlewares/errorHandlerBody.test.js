/* eslint-env jest */
/**
 * Ответ на плохое тело запроса.
 *
 * Проверяет не текст, а класс ошибки: разбор тела — проблема клиента, и 500
 * на нём означал, что в проде настоящая авария тонет в шуме чужих запросов.
 */

import express from "express";
import request from "supertest";
import { errorHandler } from "../../../core/middlewares/errorHandler.js";

const buildApp = () => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/probe", (req, res) => res.json({ ok: true, keys: Object.keys(req.body) }));
  app.use(errorHandler);
  return app;
};

describe("errorHandler: тело запроса", () => {
  it("свыше лимита отдаёт 413 с внятным кодом, а не 500", async () => {
    const res = await request(buildApp())
      .post("/probe")
      .send({ padding: "a".repeat(4096) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(res.body.error.message).toBe("Тело запроса слишком большое");
  });

  it("битый JSON — 400, а не 500", async () => {
    const res = await request(buildApp())
      .post("/probe")
      .set("content-type", "application/json")
      .send('{"a": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("корректное тело проходит дальше", async () => {
    const res = await request(buildApp()).post("/probe").send({ title: "ок" });

    expect(res.status).toBe(200);
    expect(res.body.keys).toEqual(["title"]);
  });
});
