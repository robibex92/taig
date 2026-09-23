import { prisma } from "../../../infrastructure/database/prisma.js";
import { logger } from "../../../core/utils/logger.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/errors/AppError.js";
import { maxBotService as defaultService } from "../../../infrastructure/services/MaxBotService.js";
import {
  MAX_BOT_BROADCAST_ACTIVE_STATUSES,
  MAX_BOT_BROADCAST_STATUS,
  MAX_BOT_RECIPIENT_STATUS,
  validateMaxBotText,
} from "../../../core/constants/maxBot.js";
import { describeMaxBotAudience, parseMaxBotAudience, resolveMaxBotAudience } from "./MaxBotAudience.js";
import { idToPlain, indexUsersById, mapBroadcast, mapRecipient } from "./maxBotMapper.js";

const DEFAULT_SEND_DELAY_MS = 40;
const RECIPIENT_CHUNK = 500;
/** Как часто перечитывать статус рассылки в БД, чтобы поймать «Отменить». */
const CANCEL_CHECK_EVERY = 10;

/** Статус получателя -> счётчик рассылки, который инкрементируется. */
const COUNTER_FIELD_BY_STATUS = {
  [MAX_BOT_RECIPIENT_STATUS.SENT]: "sent",
  [MAX_BOT_RECIPIENT_STATUS.FAILED]: "failed",
  [MAX_BOT_RECIPIENT_STATUS.SKIPPED]: "skipped",
};

const readDelayFromEnv = () => {
  const raw = Number(process.env.MAX_BOT_SEND_DELAY_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_SEND_DELAY_MS;
};

const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/**
 * Движок рассылок MAX-бота.
 *
 * Жизненный цикл: `draft -> queued -> running -> completed | cancelled | failed`.
 *  - создание рассылки раскладывает аудиторию по строкам-получателям
 *    (max_bot_broadcast_recipients), дальше очередь идёт по ним — это даёт
 *    «повторить неудачные» и честную статистику sent/failed/skipped;
 *  - отправка последовательная, с задержкой `MAX_BOT_SEND_DELAY_MS` (по умолчанию 40 мс),
 *    чтобы не упереться в rate limit MAX API;
 *  - получатель без диалога с ботом (`dialog.not.found`) = `skipped`, не `failed`;
 *  - блокировка `global:blocked` исключает получателя на этапе построения очереди
 *    (см. MaxBotAudience.buildMaxBotAudienceWhere);
 *  - отмена — по флагу в памяти и по статусу в БД (переживает перезапуск процесса).
 */
export class MaxBotBroadcastUseCases {
  constructor({
    db = prisma,
    service = defaultService,
    sendDelayMs,
    loggerImpl,
  } = {}) {
    this.db = db;
    this.service = service;
    this.sendDelayMs = sendDelayMs ?? readDelayFromEnv();
    this.log = loggerImpl ?? logger;
    /** id запущенных в этом процессе рассылок: защита от двойного старта и кнопка «Отменить». */
    this.runningIds = new Set();
    this.cancelledIds = new Set();
    /** Активные Promise очередей (ключ — id рассылки): для graceful shutdown и тестов. */
    this.activeRuns = new Map();
  }

  /** POST /api/admin/max-bot/broadcasts */
  async createBroadcast({ text, audience, dryRun = false, actorUserId = null }) {
    const message = validateMaxBotText(text);
    const parsed = parseMaxBotAudience(audience);
    const recipients = await resolveMaxBotAudience(this.db, parsed);

    if (!recipients.length) {
      throw new ValidationError(
        "Аудитория пуста: ни у одного незаблокированного жителя нет привязанного MAX ID"
      );
    }

    const broadcast = await this.db.maxBotBroadcast.create({
      data: {
        text: message,
        audience: parsed.raw,
        status: MAX_BOT_BROADCAST_STATUS.DRAFT,
        total: recipients.length,
        created_by: actorUserId ? BigInt(actorUserId) : null,
      },
    });

    await this._insertRecipients(broadcast.id, recipients);

    this.log.info("MAX-бот: рассылка создана", {
      broadcast_id: idToPlain(broadcast.id),
      audience: parsed.raw,
      total: recipients.length,
      dry_run: Boolean(dryRun),
    });

    // dry_run («Создать черновик») — очередь готова, но не отправляем ничего.
    // Обычное создание сразу уходит в асинхронную отправку.
    if (!dryRun) {
      this._scheduleStart(broadcast.id);
    }

    const fresh = await this.db.maxBotBroadcast.findUnique({ where: { id: broadcast.id } });
    return this._decorateBroadcast(fresh ?? broadcast);
  }

  /** POST /api/admin/max-bot/broadcasts/:id/start — отвечает сразу, очередь работает в фоне */
  async startBroadcast(id) {
    const broadcast = await this._requireBroadcast(id);

    if (!this.service.isConfigured()) {
      throw new ValidationError("MAX_BOT_TOKEN не задан — отправка невозможна");
    }

    if (broadcast.status === MAX_BOT_BROADCAST_STATUS.RUNNING) {
      return this._decorateBroadcast(broadcast);
    }

    if (broadcast.status === MAX_BOT_BROADCAST_STATUS.QUEUED) {
      return this._decorateBroadcast(broadcast);
    }

    if (broadcast.status === MAX_BOT_BROADCAST_STATUS.CANCELLED) {
      throw new ConflictError(
        "Рассылка отменена. Чтобы дозаполнить её, используйте «повторить неудачные»"
      );
    }

    const pendingCount = await this.db.maxBotBroadcastRecipient.count({
      where: {
        broadcast_id: broadcast.id,
        status: MAX_BOT_RECIPIENT_STATUS.PENDING,
      },
    });

    if (pendingCount === 0) {
      throw new ValidationError(
        "Нет неотправленных получателей — отправка уже завершена. Доступен повтор неудачных"
      );
    }

    const updated = await this.db.maxBotBroadcast.update({
      where: { id: broadcast.id },
      data: {
        status: MAX_BOT_BROADCAST_STATUS.QUEUED,
        started_at: broadcast.started_at ?? new Date(),
        finished_at: null,
        error: null,
      },
    });

    this._scheduleStart(updated.id);

    return this._decorateBroadcast(updated);
  }

  /** POST /api/admin/max-bot/broadcasts/:id/cancel */
  async cancelBroadcast(id) {
    const broadcast = await this._requireBroadcast(id);

    if (
      ![MAX_BOT_BROADCAST_STATUS.QUEUED, MAX_BOT_BROADCAST_STATUS.RUNNING].includes(
        broadcast.status
      )
    ) {
      throw new ConflictError("Отменить можно только queued/running рассылку");
    }

    this.cancelledIds.add(idToPlain(broadcast.id));

    const updated = await this.db.maxBotBroadcast.update({
      where: { id: broadcast.id },
      data: {
        status: MAX_BOT_BROADCAST_STATUS.CANCELLED,
        finished_at: new Date(),
        error: "Отменено администратором",
      },
    });

    this.log.info("MAX-бот: рассылка отменена", { broadcast_id: idToPlain(broadcast.id) });

    return this._decorateBroadcast(updated);
  }

  /** POST /api/admin/max-bot/broadcasts/:id/retry-failed — «повторить неудачные» */
  async retryFailed(id, { autoStart = true } = {}) {
    const broadcast = await this._requireBroadcast(id);

    if (!this.service.isConfigured()) {
      throw new ValidationError("MAX_BOT_TOKEN не задан — отправка невозможна");
    }

    const reset = await this.db.maxBotBroadcastRecipient.updateMany({
      where: {
        broadcast_id: broadcast.id,
        status: { in: [MAX_BOT_RECIPIENT_STATUS.FAILED, MAX_BOT_RECIPIENT_STATUS.SKIPPED] },
      },
      data: { status: MAX_BOT_RECIPIENT_STATUS.PENDING, error: null, sent_at: null },
    });

    if (!reset.count) {
      // Прерванная перезапуском рассылка: неудачных нет, но очередь не пройдена.
      const pendingLeft = await this.db.maxBotBroadcastRecipient.count({
        where: {
          broadcast_id: broadcast.id,
          status: MAX_BOT_RECIPIENT_STATUS.PENDING,
        },
      });

      if (pendingLeft > 0) {
        return this.startBroadcast(idToPlain(broadcast.id));
      }

      throw new ValidationError("Неудачных или пропущенных получателей нет — повторять нечего");
    }

    const [total, sent, failed, skipped] = await Promise.all([
      this.db.maxBotBroadcastRecipient.count({ where: { broadcast_id: broadcast.id } }),
      this.db.maxBotBroadcastRecipient.count({
        where: { broadcast_id: broadcast.id, status: MAX_BOT_RECIPIENT_STATUS.SENT },
      }),
      this.db.maxBotBroadcastRecipient.count({
        where: { broadcast_id: broadcast.id, status: MAX_BOT_RECIPIENT_STATUS.FAILED },
      }),
      this.db.maxBotBroadcastRecipient.count({
        where: { broadcast_id: broadcast.id, status: MAX_BOT_RECIPIENT_STATUS.SKIPPED },
      }),
    ]);

    const updated = await this.db.maxBotBroadcast.update({
      where: { id: broadcast.id },
      data: {
        status: MAX_BOT_BROADCAST_STATUS.DRAFT,
        total,
        sent,
        failed,
        skipped,
        error: null,
        finished_at: null,
      },
    });

    this.log.info("MAX-бот: неудачные получатели сброшены на повтор", {
      broadcast_id: idToPlain(broadcast.id),
      reset: reset.count,
    });

    if (autoStart) {
      return this.startBroadcast(idToPlain(updated.id));
    }

    return this._decorateBroadcast(updated);
  }

  /**
   * DELETE /api/admin/max-bot/broadcasts/:id — удалить черновик.
   *
   * Черновик («Создать черновик», dry_run) не имеет статуса queued/running, поэтому
   * кнопка «Отменить» на нём законно неактивна: без этого действия такая строка
   * оставалась бы в журнале навсегда.
   */
  async deleteBroadcast(id) {
    const broadcast = await this._requireBroadcast(id);

    if (MAX_BOT_BROADCAST_ACTIVE_STATUSES.includes(broadcast.status)) {
      throw new ConflictError("Сначала отмените отправку, потом удаляйте рассылку");
    }

    if (broadcast.status === MAX_BOT_BROADCAST_STATUS.COMPLETED) {
      throw new ConflictError(
        "Завершённую рассылку удалять нельзя — это единственная запись о том, что ушло жителям"
      );
    }

    await this.db.maxBotBroadcast.delete({ where: { id: broadcast.id } });

    this.log.info("MAX-бот: рассылка удалена", {
      broadcast_id: idToPlain(broadcast.id),
      status: broadcast.status,
    });

    return { deleted: idToPlain(broadcast.id) };
  }

  /**
   * Разбор осиротевших рассылок при старте процесса.
   *
   * Очередь живёт в памяти, поэтому `pm2 restart` оставляет в БД `queued`/`running`
   * строки, которые никто не отправляет: журнал вечно показывал бы их активными.
   */
  async reconcileInterruptedBroadcasts() {
    const orphans = await this.db.maxBotBroadcast.findMany({
      where: { status: { in: MAX_BOT_BROADCAST_ACTIVE_STATUSES } },
      select: { id: true, status: true },
    });

    const stale = orphans.filter((row) => !this.runningIds.has(idToPlain(row.id)));
    if (!stale.length) return { reconciled: 0 };

    await this.db.maxBotBroadcast.updateMany({
      where: { id: { in: stale.map((row) => row.id) } },
      data: {
        status: MAX_BOT_BROADCAST_STATUS.FAILED,
        error: "Отправка прервана перезапуском API. Нажмите «Повторить неудачные», чтобы продолжить",
        finished_at: new Date(),
      },
    });

    this.log.warn("MAX-бот: рассылки без процесса отправки помечены прерванными", {
      count: stale.length,
      ids: stale.map((row) => idToPlain(row.id)),
    });

    return { reconciled: stale.length };
  }

  /** GET /api/admin/max-bot/broadcasts */
  async listBroadcasts({ limit = 30, offset = 0 } = {}) {
    const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const skip = Math.max(Number(offset) || 0, 0);

    const [rows, total] = await Promise.all([
      this.db.maxBotBroadcast.findMany({
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take,
        skip,
      }),
      this.db.maxBotBroadcast.count(),
    ]);

    const creatorIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean).map(String))];
    const creators = creatorIds.length
      ? await this.db.user.findMany({
          where: { user_id: { in: creatorIds.map((id) => BigInt(id)) } },
          select: { user_id: true, username: true, first_name: true, last_name: true },
        })
      : [];

    return {
      items: (await this._decorateBroadcasts(rows, indexUsersById(creators))),
      total,
      limit: take,
      offset: skip,
      running_in_process: [...this.runningIds],
    };
  }

  /** GET /api/admin/max-bot/broadcasts/:id/recipients */
  async getRecipients(id, { status = null, limit = 100, offset = 0 } = {}) {
    const broadcast = await this._requireBroadcast(id);

    const where = {
      broadcast_id: broadcast.id,
      ...(status ? { status } : {}),
    };

    const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const skip = Math.max(Number(offset) || 0, 0);

    const [rows, total, grouped] = await Promise.all([
      this.db.maxBotBroadcastRecipient.findMany({
        where,
        orderBy: { id: "asc" },
        take,
        skip,
      }),
      this.db.maxBotBroadcastRecipient.count({ where }),
      this.db.maxBotBroadcastRecipient.groupBy({
        by: ["status"],
        where: { broadcast_id: broadcast.id },
        _count: true,
      }),
    ]);

    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean).map(String))];
    const users = userIds.length
      ? await this.db.user.findMany({
          where: { user_id: { in: userIds.map((uid) => BigInt(uid)) } },
          select: { user_id: true, username: true, first_name: true, last_name: true },
        })
      : [];

    return {
      broadcast: await this._decorateBroadcast(broadcast),
      items: rows.map((row) => mapRecipient(row, indexUsersById(users))),
      total,
      limit: take,
      offset: skip,
      counts: Object.fromEntries(grouped.map((g) => [g.status, g._count])),
    };
  }

  // ==================== внутренняя очередь ====================

  _scheduleStart(id) {
    const key = idToPlain(id);

    if (this.runningIds.has(key)) {
      this.log.warn("MAX-бот: рассылка уже отправляется, повтор игнорируется", {
        broadcast_id: key,
      });
      return this.activeRuns.get(key) ?? Promise.resolve();
    }

    this.runningIds.add(key);

    const run = this._runQueue(id)
      .catch((error) => {
        this.log.error("MAX-бот: сбой очереди рассылки", {
          broadcast_id: key,
          error: error.message,
        });
        return this.db.maxBotBroadcast
          .update({
            where: { id: BigInt(key) },
            data: {
              status: MAX_BOT_BROADCAST_STATUS.FAILED,
              error: error.message,
              finished_at: new Date(),
            },
          })
          .catch(() => null);
      })
      .finally(() => {
        this.runningIds.delete(key);
        this.cancelledIds.delete(key);
        this.activeRuns.delete(key);
      });

    this.activeRuns.set(key, run);
    return run;
  }

  /** Ждёт завершения всех очередей, запущенных в этом процессе (graceful shutdown / тесты). */
  waitForActiveRuns() {
    return Promise.all([...this.activeRuns.values()]);
  }

  async _runQueue(id) {
    const broadcastId = BigInt(String(id));
    const key = idToPlain(broadcastId);

    const broadcast = await this.db.maxBotBroadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) return;

    if (broadcast.status === MAX_BOT_BROADCAST_STATUS.CANCELLED) return;

    await this.db.maxBotBroadcast.update({
      where: { id: broadcastId },
      data: {
        status: MAX_BOT_BROADCAST_STATUS.RUNNING,
        started_at: broadcast.started_at ?? new Date(),
      },
    });

    const queue = await this.db.maxBotBroadcastRecipient.findMany({
      where: { broadcast_id: broadcastId, status: MAX_BOT_RECIPIENT_STATUS.PENDING },
      orderBy: { id: "asc" },
    });

    this.log.info("MAX-бот: старт рассылки", {
      broadcast_id: key,
      pending: queue.length,
      delay_ms: this.sendDelayMs,
    });

    let processed = 0;

    for (const recipient of queue) {
      if (await this._isCancelled(broadcastId, key, processed)) {
        this.log.info("MAX-бот: рассылка остановлена по отмене", {
          broadcast_id: key,
          processed,
        });
        return;
      }

      processed += 1;

      const result = await this.service.sendMessage(String(recipient.max_id), broadcast.text);
      const status = result.ok
        ? MAX_BOT_RECIPIENT_STATUS.SENT
        : result.skipped
          ? MAX_BOT_RECIPIENT_STATUS.SKIPPED
          : MAX_BOT_RECIPIENT_STATUS.FAILED;

      await this.db.maxBotBroadcastRecipient.update({
        where: { id: recipient.id },
        data: {
          status,
          error: result.ok ? null : String(result.error || "Ошибка MAX API").slice(0, 500),
          sent_at: result.ok ? new Date() : null,
        },
      });

      await this.db.maxBotBroadcast.update({
        where: { id: broadcastId },
        data: { [COUNTER_FIELD_BY_STATUS[status]]: { increment: 1 } },
      });

      if (processed < queue.length) {
        await sleep(this.sendDelayMs);
      }
    }

    const fresh = await this.db.maxBotBroadcast.findUnique({ where: { id: broadcastId } });
    if (fresh && fresh.status === MAX_BOT_BROADCAST_STATUS.CANCELLED) return;

    await this.db.maxBotBroadcast.update({
      where: { id: broadcastId },
      data: {
        status: MAX_BOT_BROADCAST_STATUS.COMPLETED,
        finished_at: new Date(),
      },
    });

    this.log.info("MAX-бот: рассылка завершена", {
      broadcast_id: key,
      sent: fresh?.sent ?? 0,
      failed: fresh?.failed ?? 0,
      skipped: fresh?.skipped ?? 0,
    });
  }

  /** Отмена: сначала локальный флаг (мгновенно), раз в CANCEL_CHECK_EVERY — статус из БД. */
  async _isCancelled(broadcastId, key, processed) {
    if (this.cancelledIds.has(key)) return true;
    if (processed > 0 && processed % CANCEL_CHECK_EVERY !== 0) return false;

    const fresh = await this.db.maxBotBroadcast
      .findUnique({ where: { id: broadcastId }, select: { status: true } })
      .catch(() => null);

    return fresh?.status === MAX_BOT_BROADCAST_STATUS.CANCELLED;
  }

  async _insertRecipients(broadcastId, recipients) {
    for (let i = 0; i < recipients.length; i += RECIPIENT_CHUNK) {
      const chunk = recipients.slice(i, i + RECIPIENT_CHUNK);

      await this.db.maxBotBroadcastRecipient.createMany({
        data: chunk.map((recipient) => ({
          broadcast_id: broadcastId,
          user_id: recipient.user_id ? BigInt(recipient.user_id) : null,
          max_id: BigInt(recipient.max_id),
          status: MAX_BOT_RECIPIENT_STATUS.PENDING,
        })),
        skipDuplicates: true,
      });
    }
  }

  async _requireBroadcast(id) {
    if (!/^\d+$/.test(String(id ?? ""))) {
      throw new ValidationError("Некорректный id рассылки");
    }

    const broadcast = await this.db.maxBotBroadcast.findUnique({ where: { id: BigInt(id) } });
    if (!broadcast) {
      throw new NotFoundError("Рассылка не найдена");
    }

    return broadcast;
  }

  async _decorateBroadcast(row, creatorIndex = null) {
    const [broadcast] = await this._decorateBroadcasts([row], creatorIndex);
    return broadcast;
  }

  async _decorateBroadcasts(rows, creatorIndex = null) {
    let index = creatorIndex;

    if (!index) {
      const creatorIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean).map(String))];
      const creators = creatorIds.length
        ? await this.db.user.findMany({
            where: { user_id: { in: creatorIds.map((id) => BigInt(id)) } },
            select: { user_id: true, username: true, first_name: true, last_name: true },
          })
        : [];
      index = indexUsersById(creators);
    }

    return rows.map((row) => ({
      ...mapBroadcast(row, index),
      audience_description: safeDescribeAudience(row.audience),
      running: this.runningIds.has(idToPlain(row.id)),
    }));
  }
}

const safeDescribeAudience = (audience) => {
  try {
    return describeMaxBotAudience(audience);
  } catch {
    return audience;
  }
};

export default MaxBotBroadcastUseCases;
