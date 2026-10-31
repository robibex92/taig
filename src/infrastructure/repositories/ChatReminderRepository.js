import { prisma } from "../database/prisma.js";

/**
 * Напоминания (`chat_reminders`).
 *
 * Ключ срабатывания (`last_occurrence_key`) пишется в базу до отправки: после
 * рестарта процесса планировщик видит, что это «10:00 31.10» уже отправлено, и
 * не дублирует сообщение. Неудача помечается отдельно — её планировщик может
 * повторить, но не больше нескольких раз.
 */
export class ChatReminderRepository {
  async list({ platform = null, activeOnly = false } = {}) {
    const where = {};

    if (platform) where.platform = platform;
    if (activeOnly) where.is_active = true;

    return prisma.chatReminder.findMany({ where, orderBy: { id: "asc" } });
  }

  async getById(id) {
    return prisma.chatReminder.findUnique({ where: { id: BigInt(id) } });
  }

  async create(input) {
    return prisma.chatReminder.create({
      data: {
        platform: input.platform,
        chat_record_id: BigInt(input.chatRecordId),
        text: input.text,
        schedule_kind: input.scheduleKind,
        time_of_day: input.timeOfDay,
        weekdays: input.weekdays ?? null,
        day_of_month: input.dayOfMonth ?? null,
        last_day_of_month: input.lastDayOfMonth ?? false,
        is_active: input.isActive ?? true,
      },
    });
  }

  async update(id, patch) {
    return prisma.chatReminder.update({
      where: { id: BigInt(id) },
      data: {
        ...(patch.chatRecordId !== undefined && { chat_record_id: BigInt(patch.chatRecordId) }),
        ...(patch.text !== undefined && { text: patch.text }),
        ...(patch.scheduleKind !== undefined && { schedule_kind: patch.scheduleKind }),
        ...(patch.timeOfDay !== undefined && { time_of_day: patch.timeOfDay }),
        ...(patch.weekdays !== undefined && { weekdays: patch.weekdays }),
        ...(patch.dayOfMonth !== undefined && { day_of_month: patch.dayOfMonth }),
        ...(patch.lastDayOfMonth !== undefined && { last_day_of_month: patch.lastDayOfMonth }),
        ...(patch.isActive !== undefined && { is_active: patch.isActive }),
      },
    });
  }

  async delete(id) {
    return prisma.chatReminder.delete({ where: { id: BigInt(id) } });
  }

  /** Занять срабатывание до отправки: другой процесс/рестарт его не повторит. */
  async beginOccurrence(id, key) {
    return prisma.chatReminder.update({
      where: { id: BigInt(id) },
      data: { last_occurrence_key: key, last_result: null, last_error: null, failed_attempts: 0 },
    });
  }

  async recordSuccess(id) {
    return prisma.chatReminder.update({
      where: { id: BigInt(id) },
      data: { last_result: "sent", last_error: null, last_sent_at: new Date(), failed_attempts: 0 },
    });
  }

  async recordFailure(id, error) {
    return prisma.chatReminder.update({
      where: { id: BigInt(id) },
      data: { last_result: "failed", last_error: String(error ?? "").slice(0, 500), failed_attempts: { increment: 1 } },
    });
  }

  /** Момент пропущен (сервер стоял дольше окна догона): не отправляем задним числом. */
  async recordSkipped(id, key) {
    return prisma.chatReminder.update({
      where: { id: BigInt(id) },
      data: { last_occurrence_key: key, last_result: "skipped" },
    });
  }
}

export default new ChatReminderRepository();
