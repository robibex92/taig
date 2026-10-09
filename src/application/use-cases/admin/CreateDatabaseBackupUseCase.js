import { spawn } from "node:child_process";
import { DatabaseError, ValidationError } from "../../../domain/errors/index.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Резервная копия базы: `pg_dump` в формат SQL, который можно разобрать любым
 * `psql` и открыть глазами.
 *
 * Почему не свой дамп через Prisma: дамп = схема + данные + порядки
 * идентификаторов + последовательности. Воспроизвести это запросами честнее,
 * чем написать, — а `pg_dump` на сервере есть, раз оттуда же гоняется `psql`.
 */

/** Потолок дампа: больше — это уже не «копия базы ЖК», а способ положить процесс. */
const MAX_DUMP_BYTES = 200 * 1024 * 1024;

/** Как долго ждать ответа базы, прежде чем признать подключение зависшим. */
const CONNECT_TIMEOUT_SECONDS = "10";

/**
 * Разбор строки подключения в переменные `PG*`.
 *
 * Пароль не передаётся в argv: командную строку дочернего процесса видно через
 * `ps` любому пользователю машины. Libpq читает набор переменных `PG*`, поэтому
 * строка соединения разбирается на них, а в аргументы не попадает ничего.
 *
 * Сначала штатный парсер Node, потом ручной разбор: WHATWG-`URL` отказывает
 * строкам, где пароль содержит `$` или `+` без экранирования, а такие пароли в
 * бою обычное дело. Отказ парсера не должен означать «копию снять нельзя».
 */
const CONNECTION_REGEX =
  /^([a-z][a-z0-9+.-]*):\/\/(?:([^:@/?]*)(?::([^@/?]*))?@)?([^:?/]+)(?::(\d+))?(?:\/([^?#]*))?/i;

const decode = (value) => {
  if (value === undefined || value === null) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    // Процент в пароле без валидного экранирования — берём как есть.
    return value;
  }
};

export const pgEnvFromDatabaseUrl = (rawUrl) => {
  const text = String(rawUrl ?? "").trim();
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text)?.[1]?.toLowerCase();

  if (scheme !== undefined && scheme !== "postgresql" && scheme !== "postgres") {
    throw new ValidationError("DATABASE_URL должен быть протокола postgresql://");
  }

  let parsed;

  try {
    const url = new URL(text);
    parsed = {
      host: url.hostname,
      port: url.port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
    };
  } catch {
    const match = CONNECTION_REGEX.exec(text);

    if (!match) {
      throw new ValidationError("DATABASE_URL не разбирается как строка подключения PostgreSQL");
    }

    const [, , user, password, host, port, database] = match;

    parsed = { host, port, user: decode(user), password: decode(password), database };
  }

  if (!parsed.host || !parsed.database) {
    throw new ValidationError("В DATABASE_URL нет хоста или имени базы");
  }

  return {
    PGHOST: parsed.host,
    PGPORT: parsed.port || "5432",
    PGUSER: parsed.user,
    PGPASSWORD: parsed.password,
    PGDATABASE: parsed.database,
  };
};

/**
 * Сообщения libpq умеют печатать строку соединения целиком, то есть с паролем.
 * В журнал и в ответ наружу уходит вычищенный текст.
 */
export const redactConnectionSecrets = (text) =>
  String(text ?? "")
    .replace(/\/\/[^@/\s]*:[^@/\s]*@/g, "//***:***@")
    .replace(/(password=)[^&\s]*/gi, "$1***");

export class CreateDatabaseBackupUseCase {
  constructor(spawnImpl = spawn, env = process.env, maxDumpBytes = MAX_DUMP_BYTES) {
    this.spawn = spawnImpl;
    this.env = env;
    this.maxDumpBytes = maxDumpBytes;
  }

  /** @returns Promise<{ buffer: Buffer, filename: string, sizeBytes: number, tookMs: number }> */
  async execute() {
    // Отдельная строка для копий: дамп через пул соединений (порт пулера) часто
    // не работает, тогда можно указать прямой порт, не меняя DATABASE_URL приложения.
    const connectionString =
      this.env.BACKUP_DATABASE_URL?.trim() || this.env.DATABASE_URL?.trim();

    if (!connectionString) {
      throw new ValidationError("DATABASE_URL не задан — копировать нечего");
    }

    const pgEnv = pgEnvFromDatabaseUrl(connectionString);
    const startedAt = Date.now();
    const filename = `taiginsky-${new Date()
      .toISOString()
      .replace(/[:T.]/g, "-")
      .slice(0, 19)}.sql`;

    const buffer = await this.#runDump({ ...this.env, ...pgEnv, PGCONNECT_TIMEOUT: CONNECT_TIMEOUT_SECONDS });

    logger.info("Database backup created", {
      filename,
      sizeBytes: buffer.length,
      tookMs: Date.now() - startedAt,
    });

    return { buffer, filename, sizeBytes: buffer.length, tookMs: Date.now() - startedAt };
  }

  #runDump(env) {
    const args = [
      "--format=plain",
      "--no-owner",
      "--no-privileges",
      "--no-password",
      "--encoding=UTF8",
    ];

    return new Promise((resolve, reject) => {
      const child = this.spawn("pg_dump", args, { env });

      const chunks = [];
      let stderr = "";
      let bytes = 0;
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(error);
      };

      child.on("error", (error) => {
        // ENOENT — это «на сервере нет pg_dump», а не «база упала».
        if (error.code === "ENOENT") {
          fail(new DatabaseError("На сервере не найден pg_dump — установите postgresql-client"));
          return;
        }

        fail(new DatabaseError(`Не удалось запустить pg_dump: ${redactConnectionSecrets(error.message)}`));
      });

      child.stdout.on("data", (chunk) => {
        bytes += chunk.length;

        if (bytes > this.maxDumpBytes) {
          fail(
            new DatabaseError(
              `Копия вышла за предел ${Math.round(this.maxDumpBytes / 1024 / 1024)} МБ — отменено`
            )
          );
          return;
        }

        chunks.push(chunk);
      });

      child.stderr.on("data", (chunk) => {
        // Хвост сообщений об ошибках короткий; держать весь поток смысла нет.
        stderr = (stderr + chunk.toString()).slice(-2000);
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;

        if (code !== 0) {
          logger.error("pg_dump failed", { code, stderr: redactConnectionSecrets(stderr) });
          reject(
            new DatabaseError(
              `pg_dump завершился с кодом ${code}: ${redactConnectionSecrets(stderr).trim() || "без сообщения"}`
            )
          );
          return;
        }

        resolve(Buffer.concat(chunks));
      });
    });
  }
}
