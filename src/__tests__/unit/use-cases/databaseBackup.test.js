import { describe, it, expect } from "@jest/globals";
import { EventEmitter } from "node:events";

import {
  CreateDatabaseBackupUseCase,
  pgEnvFromDatabaseUrl,
  redactConnectionSecrets,
} from "../../../application/use-cases/admin/CreateDatabaseBackupUseCase.js";

/**
 * Снятие резервной копии: `pg_dump` обязан получать доступ к базе через
 * переменные окружения, а не через строку соединения в аргументах — командную
 * строку дочернего процесса видно в `ps` любому на машине. И наружу ни в журнал,
 * ни в ответ не должен уйти пароль.
 */

const DB_URL = "postgresql://backend_user:sup3r-secret@db.internal:6543/mydatabase?schema=public";

/** @param {{chunks?: string[], stderr?: string, code?: number, error?: Error}} behaviour */
const spawnWith = (behaviour, calls) => (command, args, options) => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {
    child.killed = true;
  };

  calls.push({ command, args, env: options.env, child });

  setTimeout(() => {
    if (behaviour.error) {
      child.emit("error", behaviour.error);
      return;
    }

    for (const chunk of behaviour.chunks ?? []) {
      child.stdout.emit("data", Buffer.from(chunk));
    }

    if (behaviour.stderr) {
      child.stderr.emit("data", Buffer.from(behaviour.stderr));
    }

    child.emit("close", behaviour.code ?? 0);
  }, 0);

  return child;
};

const run = (behaviour, env = { DATABASE_URL: DB_URL }, maxBytes) => {
  const calls = [];
  const useCase = new CreateDatabaseBackupUseCase(spawnWith(behaviour, calls), env, maxBytes);

  return { useCase, calls };
};

describe("строка подключения", () => {
  it("разбирается в переменные PG*, а не в аргументы", () => {
    expect(pgEnvFromDatabaseUrl(DB_URL)).toEqual({
      PGHOST: "db.internal",
      PGPORT: "6543",
      PGUSER: "backend_user",
      PGPASSWORD: "sup3r-secret",
      PGDATABASE: "mydatabase",
    });
  });

  it("отвергает не-postgres и мусор", () => {
    expect(() => pgEnvFromDatabaseUrl("mysql://user@host/db")).toThrow(/postgresql/);
    expect(() => pgEnvFromDatabaseUrl("не строка подключения")).toThrow(/не разбирается/);
  });

  it("разбирает пароль с `$`, который WHATWG-парсер отклоняет", () => {
    // Бою такие пароли обычны: `new URL()` падает на них, а копия базы от этого
    // не должна становиться недоступной.
    expect(pgEnvFromDatabaseUrl("postgresql://backend_user:sup3r$ecret+1@db.internal:6543/mydatabase?schema=public")).toEqual(
      {
        PGHOST: "db.internal",
        PGPORT: "6543",
        PGUSER: "backend_user",
        PGPASSWORD: "sup3r$ecret+1",
        PGDATABASE: "mydatabase",
      }
    );
  });

  it("вычищает пароль из текста libpq", () => {
    const leaked =
      'pg_dump: error: connection to server at "db.internal" failed: FATAL: password authentication failed, ' +
      "connection URI postgresql://backend_user:sup3r-***@db.internal:6543/mydatabase, password=sup3r-secret";
    const redacted = redactConnectionSecrets(leaked);

    expect(redacted).not.toContain("sup3r-secret");
    // Текст ошибки для человека должен остаться: по нему и понимают, что упало.
    expect(redacted).toContain("password authentication failed");
  });
});

describe("создание копии", () => {
  it("зовёт pg_dump без секрета в аргументах и отдаёт собранный файл", async () => {
    const { useCase, calls } = run({ chunks: ["BEGIN;\n", "SET;\n"] });

    const result = await useCase.execute();

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("pg_dump");
    expect(calls[0].args).toContain("--no-password");
    expect(calls[0].args.join(" ")).not.toContain("sup3r-secret");
    expect(calls[0].env.PGHOST).toBe("db.internal");
    expect(calls[0].env.PGCONNECT_TIMEOUT).toBe("10");

    expect(result.buffer.toString()).toBe("BEGIN;\nSET;\n");
    expect(result.sizeBytes).toBe(12);
    expect(result.filename).toMatch(/^taiginsky-\d{4}-\d{2}-\d{2}-.*\.sql$/);
  });

  it("слушает BACKUP_DATABASE_URL, когда его задают (порт пулера дампу не подходит)", async () => {
    const { useCase, calls } = run(
      { chunks: ["x"] },
      {
        DATABASE_URL: DB_URL,
        BACKUP_DATABASE_URL: "postgresql://backup_user:backup-pass@db.direct:5432/mydatabase",
      }
    );

    await useCase.execute();

    expect(calls[0].env.PGHOST).toBe("db.direct");
    expect(calls[0].env.PGPORT).toBe("5432");
    expect(calls[0].env.PGPASSWORD).toBe("backup-pass");
  });

  it("отсутствующий pg_dump — отдельная подсказка, а не «база упала»", async () => {
    const missing = Object.assign(new Error("spawn pg_dump ENOENT"), { code: "ENOENT" });
    const { useCase } = run({ error: missing });

    await expect(useCase.execute()).rejects.toThrow(/postgresql-client/);
  });

  it("нештучный код возврата отдаёт вычищенный stderr", async () => {
    const { useCase } = run({
      chunks: [],
      code: 1,
      stderr: "pg_dump: error: connection to server failed: password=sup3r-secret",
    });

    const error = await useCase.execute().catch((caught) => caught);

    expect(error.message).toMatch(/кодом 1/);
    expect(error.message).not.toContain("sup3r-secret");
  });

  it("обрывает дамп, не влезший в потолок", async () => {
    const { useCase, calls } = run({ chunks: ["AAAAAAAAAA", "BBBBBBBBBB"] }, undefined, 15);

    await expect(useCase.execute()).rejects.toThrow(/отменено/);
    expect(calls[0].child.killed).toBe(true);
  });

  it("без строки подключения ничего не запускает", async () => {
    const { useCase, calls } = run({ chunks: ["x"] }, {});

    await expect(useCase.execute()).rejects.toThrow(/DATABASE_URL не задан/);
    expect(calls).toHaveLength(0);
  });
});
