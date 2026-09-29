import { prisma } from "../database/prisma.js";
import { AuthenticationError, AppError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Хендоверы авторизации: «мини-апп/бот выдал код или requestId → браузер его
 * забирает». Один и тот же репозиторий служит MAX (`code`, `request`) и
 * Telegram-боту (`tg-code`, `tg-request`).
 *
 * Одноразовость обеспечивает `consume`: строка читается и удаляется в одной
 * транзакции, поэтому два параллельных обмена одним кодом дают успех только
 * одному — второй получает отказ, а не вторую сессию.
 */
export class AuthHandoffRepository {
  /** `kind` — "code" | "request"; срок жизни задаёт вызывающий. */
  async put({ kind, key, userId, ttlMs }) {
    this._purgeExpired();

    try {
      await prisma.authHandoff.upsert({
        where: { kind_key: { kind, key } },
        create: {
          kind,
          key,
          user_id: BigInt(userId),
          expires_at: new Date(Date.now() + ttlMs),
        },
        update: {
          user_id: BigInt(userId),
          expires_at: new Date(Date.now() + ttlMs),
        },
      });
    } catch (error) {
      throw this._mapError(error);
    }
  }

  /** @returns {Promise<bigint|null>} `user_id` — или null, если записи нет или она просрочена. */
  async consume(kind, key) {
    try {
      /**
       * Читаем и удаляем типизированными запросами внутри транзакции, а не
       * `DELETE … RETURNING` через `$queryRaw`: на проде сырой запрос падал с
       * `PrismaClientUnknownRequestError: Invalid 'user_id'` (строка 43 прежней
       * реализации), хотя `upsert` той же таблицы работал — то есть обмена кода
       * не было вовсе, и фронт показывал «Internal server error».
       *
       * Одноразовость сохраняет `deleteMany` по `id`: параллельный claim того же
       * кода блокируется на строке и получает `count: 0`, то есть отказ, а не
       * второй успешный вход.
       */
      const now = new Date();

      return await prisma.$transaction(async (tx) => {
        const row = await tx.authHandoff.findFirst({
          where: { kind, key, expires_at: { gt: now } },
          select: { id: true, user_id: true },
        });

        if (!row) {
          return null;
        }

        const { count } = await tx.authHandoff.deleteMany({ where: { id: row.id } });

        return count === 1 ? row.user_id : null;
      });
    } catch (error) {
      throw this._mapError(error);
    }
  }

  /** Просроченные строки никто не чистит, кроме нас: чистим попутно, раз в запись. */
  _purgeExpired() {
    prisma.authHandoff
      .deleteMany({ where: { expires_at: { lte: new Date() } } })
      .catch((error) =>
        logger.warn("Could not purge auth handoffs", {
          code: error?.code,
          error: error?.message,
        })
      );
  }

  /**
   * Если таблицы ещё нет, «Login code is invalid» вводило бы в заблуждение:
   * на самом деле не применена миграция (код кладётся в БД, а не в память процесса).
   *
   * Второе частое «таблица есть, а запрос падает» — роли приложения не выдали
   * нужные привилегии (DDL выполнялся от postgres/админской роли). По этому
   * тексту видно, что чинить: `grant`, а не миграция.
   */
  _mapError(error) {
    const message = String(error?.message ?? error ?? "");

    logger.error("Auth handoff query failed", {
      code: error?.code,
      meta: error?.meta?.field ?? null,
      error: message,
    });

    if (error?.code === "P2021" || error?.code === "P2022") {
      throw new AppError(
        "Таблица auth_handoffs отсутствует: примените prisma/migrations/add_auth_handoffs.sql",
        500
      );
    }

    if (/permission denied/i.test(message)) {
      throw new AppError(
        "У роли приложения нет прав на таблицу auth_handoffs: выполните grant (см. лог сервера)",
        500
      );
    }

    if (error instanceof AuthenticationError) throw error;
    throw error;
  }
}

export default new AuthHandoffRepository();
