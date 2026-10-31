import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";

const ok = (res, data) => res.json({ success: true, data });

const toBool = (value) => value === true || value === "true" || value === 1 || value === "1";

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`Некорректное число: ${String(value)}`);
  }

  return parsed;
};

/**
 * Контроллер раздела админки «Боты в чатах»: условия автоответа и напоминания.
 *
 * Маршруты закрыты authenticateJWT + requireRoles(global:admin), см.
 * src/presentation/routes/chatBot.routes.js.
 */
export class ChatBotController {
  constructor({ adminUseCases }) {
    this.admin = adminUseCases;
  }

  /** GET /auto-replies */
  listAutoReplies = asyncHandler(async (req, res) => {
    ok(res, await this.admin.listAutoReplies({ platform: req.query.platform }));
  });

  /** POST /auto-replies */
  createAutoReply = asyncHandler(async (req, res) => {
    const { platform, phrase, response, is_active } = req.body ?? {};

    const created = await this.admin.createAutoReply({
      platform,
      phrase,
      response,
      isActive: is_active === undefined ? true : toBool(is_active),
    });

    ok(res, created);
  });

  /** PATCH /auto-replies/:id */
  updateAutoReply = asyncHandler(async (req, res) => {
    const { phrase, response, is_active } = req.body ?? {};

    const updated = await this.admin.updateAutoReply({
      id: req.params.id,
      phrase,
      response,
      isActive: is_active === undefined ? undefined : toBool(is_active),
    });

    ok(res, updated);
  });

  /** DELETE /auto-replies/:id */
  deleteAutoReply = asyncHandler(async (req, res) => {
    ok(res, await this.admin.deleteAutoReply({ id: req.params.id }));
  });

  /** GET /reminders */
  listReminders = asyncHandler(async (req, res) => {
    ok(res, await this.admin.listReminders({ platform: req.query.platform }));
  });

  /** GET /reminders/preview — когда сработает такое расписание, ничего не отправляя. */
  previewReminder = asyncHandler(async (req, res) => {
    const { schedule_kind, time_of_day, weekdays, day_of_month, last_day_of_month } = req.query;

    ok(
      res,
      this.admin.previewReminder({
        scheduleKind: schedule_kind,
        timeOfDay: time_of_day,
        weekdays,
        dayOfMonth: toNullableNumber(day_of_month),
        lastDayOfMonth: toBool(last_day_of_month),
      })
    );
  });

  /** POST /reminders */
  createReminder = asyncHandler(async (req, res) => {
    const body = req.body ?? {};

    const created = await this.admin.createReminder({
      platform: body.platform,
      chatRecordId: body.chat_record_id,
      text: body.text,
      scheduleKind: body.schedule_kind,
      timeOfDay: body.time_of_day,
      weekdays: body.weekdays,
      dayOfMonth: toNullableNumber(body.day_of_month),
      lastDayOfMonth: toBool(body.last_day_of_month),
      isActive: body.is_active === undefined ? true : toBool(body.is_active),
    });

    ok(res, created);
  });

  /** PATCH /reminders/:id */
  updateReminder = asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const patch = {};

    if (body.chat_record_id !== undefined) patch.chatRecordId = body.chat_record_id;
    if (body.text !== undefined) patch.text = body.text;
    if (body.schedule_kind !== undefined) patch.scheduleKind = body.schedule_kind;
    if (body.time_of_day !== undefined) patch.timeOfDay = body.time_of_day;
    if (body.weekdays !== undefined) patch.weekdays = body.weekdays;
    if (body.day_of_month !== undefined) patch.dayOfMonth = toNullableNumber(body.day_of_month);
    if (body.last_day_of_month !== undefined) patch.lastDayOfMonth = toBool(body.last_day_of_month);
    if (body.is_active !== undefined) patch.isActive = toBool(body.is_active);

    ok(res, await this.admin.updateReminder({ id: req.params.id, ...patch }));
  });

  /** DELETE /reminders/:id */
  deleteReminder = asyncHandler(async (req, res) => {
    ok(res, await this.admin.deleteReminder({ id: req.params.id }));
  });
}

export default ChatBotController;
