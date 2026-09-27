import { prisma } from "../database/prisma.js";
import { AuthenticationError, AppError } from "../../core/errors/AppError.js";
import { logger } from "../../core/utils/logger.js";

/**
 * Хендоверы MAX-авторизации: «мини-апп выдал код/запрос → браузер его забирает».
 *
 * Одноразовость обеспечивает `consume`: строка удаляется тем же запросом, которым
 * читается (`DELETE … RETURNING`), поэтому два параллельных claim одним кодом
 * невозможны — и на втором запросе уже не «успех», а отказ.
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
      const [row] = await prisma.$queryRaw`
        DELETE FROM auth_handoffs
        WHERE kind = ${kind} AND key = ${key} AND expires_at > NOW()
        RETURNING user_id AS user_id
      `;

      return row ? row.user_id : null;
    } catch (error) {
      throw this._mapError(error);
    }
  }

  /** Просроченные строки никто не чистит, кроме нас: чистим попутно, раз в запись. */
  _purgeExpired() {
    prisma.authHandoff
      .deleteMany({ where: { expires_at: { lte: new Date() } } })
      .catch((error) => logger.warn("Could not purge auth handoffs", { error: error.message }));
  }

  /**
   * Если таблицы ещё нет, «Login code is invalid» вводило бы в заблуждение:
   * на самом деле не применена миграция (код кладётся в БД, а не в память процесса).
   */
  _mapError(error) {
    if (error.code === "P2021" || error.code === "P2022") {
      throw new AppError(
        "Таблица auth_handoffs отсутствует: примените prisma/migrations/add_auth_handoffs.sql",
        500
      );
    }

    if (error instanceof AuthenticationError) throw error;
    throw error;
  }
}

export default new AuthHandoffRepository();
