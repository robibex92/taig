import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import { MAX_BOT_TEXT_LIMIT } from "../../core/constants/maxBot.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toBool = (value) => value === true || value === "true" || value === "1";

const readText = (value) => {
  if (typeof value !== "string") {
    throw new ValidationError("Не передан текст сообщения");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError("Сообщение не может быть пустым");
  }
  if (trimmed.length > MAX_BOT_TEXT_LIMIT) {
    throw new ValidationError(
      `Слишком длинное сообщение: ${trimmed.length} символов, максимум ${MAX_BOT_TEXT_LIMIT}`
    );
  }
  return trimmed;
};

/**
 * Контроллер вкладки админки «MAX-бот».
 * Все маршруты закрыты authenticateJWT + requireRoles(GLOBAL_ROLES.ADMIN),
 * см. src/presentation/routes/maxBot.routes.js.
 */
export class MaxBotController {
  constructor({ adminUseCases, broadcastUseCases }) {
    this.admin = adminUseCases;
    this.broadcasts = broadcastUseCases;
  }

  /** GET /status */
  getStatus = asyncHandler(async (req, res) => {
    const status = await this.admin.getStatus();
    ok(res, status);
  });

  /** GET /inbox */
  getInbox = asyncHandler(async (req, res) => {
    const { limit, offset, only_unhandled, search } = req.query;

    const result = await this.admin.listInbox({
      limit: toInt(limit, 50),
      offset: toInt(offset, 0),
      onlyUnhandled: toBool(only_unhandled),
      search: typeof search === "string" && search.trim() ? search.trim() : null,
    });

    res.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  });

  /** POST /inbox/:id/handle */
  handleInboxMessage = asyncHandler(async (req, res) => {
    const { handled = true, note } = req.body ?? {};

    const message = await this.admin.setMessageHandled({
      id: req.params.id,
      handled: toBool(handled),
      note,
      actorUserId: req.user?.user_id,
    });

    ok(res, message);
  });

  /** POST /inbox/:id/reply */
  replyToInboxMessage = asyncHandler(async (req, res) => {
    const text = readText(req.body?.text);

    const message = await this.admin.replyToMessage({
      id: req.params.id,
      text,
      actorUserId: req.user?.user_id,
    });

    ok(res, message);
  });

  /** GET /audiences/preview */
  previewAudience = asyncHandler(async (req, res) => {
    const preview = await this.admin.previewAudience({ audience: req.query.audience });
    ok(res, preview);
  });

  /** POST /broadcasts */
  createBroadcast = asyncHandler(async (req, res) => {
    const { text, audience, dry_run } = req.body ?? {};

    const broadcast = await this.broadcasts.createBroadcast({
      text: readText(text),
      audience,
      dryRun: toBool(dry_run),
      actorUserId: req.user?.user_id,
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: broadcast });
  });

  /** POST /broadcasts/:id/start — запуск очереди, ответ сразу */
  startBroadcast = asyncHandler(async (req, res) => {
    const broadcast = await this.broadcasts.startBroadcast(req.params.id);
    ok(res, broadcast);
  });

  /** POST /broadcasts/:id/cancel */
  cancelBroadcast = asyncHandler(async (req, res) => {
    const broadcast = await this.broadcasts.cancelBroadcast(req.params.id);
    ok(res, broadcast);
  });

  /** POST /broadcasts/:id/retry-failed */
  retryFailedBroadcast = asyncHandler(async (req, res) => {
    const broadcast = await this.broadcasts.retryFailed(req.params.id);
    ok(res, broadcast);
  });

  /** DELETE /broadcasts/:id — удалить черновик или отменённую рассылку */
  deleteBroadcast = asyncHandler(async (req, res) => {
    const result = await this.broadcasts.deleteBroadcast(req.params.id);
    ok(res, result);
  });

  /** GET /broadcasts */
  getBroadcasts = asyncHandler(async (req, res) => {
    const { limit, offset } = req.query;
    const result = await this.broadcasts.listBroadcasts({
      limit: toInt(limit, 30),
      offset: toInt(offset, 0),
    });

    res.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
      running_in_process: result.running_in_process,
    });
  });

  /** GET /broadcasts/:id/recipients */
  getBroadcastRecipients = asyncHandler(async (req, res) => {
    const { status, limit, offset } = req.query;
    const result = await this.broadcasts.getRecipients(req.params.id, {
      status: typeof status === "string" && status ? status : null,
      limit: toInt(limit, 100),
      offset: toInt(offset, 0),
    });

    res.json({
      success: true,
      data: result.items,
      broadcast: result.broadcast,
      counts: result.counts,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  });

  /** POST /webhook/setup */
  setupWebhook = asyncHandler(async (req, res) => {
    const { url, secret, update_types } = req.body ?? {};
    const result = await this.admin.setupWebhook({
      url,
      secret,
      updateTypes: update_types,
    });

    ok(res, result);
  });
}

export default MaxBotController;
