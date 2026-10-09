/* eslint-env jest */
/**
 * Логгер не имеет права ронять запрос.
 *
 * Метаданные он пишет одной строкой JSON, а `JSON.stringify` не умеет BigInt —
 * то есть `logger.info("…", { ad_id: image.ad_id })` с BigInt-идентификатором
 * из Prisma бросал TypeError уже ПОСЛЕ успешного действия, и пользователь
 * получал 500 вместо результата.
 */

import { jest, describe, it, expect } from "@jest/globals";
import { logger } from "../../../core/utils/logger.js";

describe("logger", () => {
  it("пишет BigInt в метаданных, не падая", () => {
    expect(() =>
      logger.info("Главное фото обновлено", {
        ad_id: 42n,
        user_id: 7n,
        count: 3,
        nested: { image_id: 8n },
      })
    ).not.toThrow();
  });

  it("не падает и на объекте, который вообще нельзя сериализовать", () => {
    const circular = { name: "ad" };
    circular.self = circular;

    expect(() => logger.info("Пробуем записать странное", { data: circular })).not.toThrow();
  });

  it("обычные поля продолжают попадать в сообщение", () => {
    const written = [];
    const spy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        written.push(String(chunk));
        return true;
      });

    logger.info("Проверка метаданных", { ad_id: 99n, status: "active" });
    spy.mockRestore();

    const line = written.join("");
    expect(line).toContain('"ad_id":"99"');
    expect(line).toContain('"status":"active"');
  });
});
