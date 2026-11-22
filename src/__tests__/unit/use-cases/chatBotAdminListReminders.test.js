/* eslint-env jest */
/**
 * Регрессия 500 в админке «Напоминания»: `rows.map(serializeReminder)`
 * передаёт вторым аргументом индекс массива, а serializeReminder ждёт там
 * дату («now») — nextOccurrence падает с `from.getTime is not a function`.
 * Список с любой строкой обязан сериализоваться без исключения.
 */

import { jest } from "@jest/globals";
import ChatBotAdminUseCases from "../../../application/use-cases/chatBot/ChatBotAdminUseCases.js";

const row = (id, over = {}) => ({
  id: BigInt(id),
  platform: "max",
  chat_record_id: 5n,
  text: "Напоминание",
  schedule_kind: "monthly",
  time_of_day: "10:00",
  weekdays: null,
  day_of_month: null,
  last_day_of_month: true,
  is_active: true,
  last_occurrence_key: "2026-11T10:00",
  last_result: "failed",
  last_error: "error.not.found",
  last_sent_at: null,
  failed_attempts: 2,
  created_at: new Date("2026-10-31T08:00:00Z"),
  ...over,
});

const build = (rows) =>
  new ChatBotAdminUseCases({
    reminderRepository: { list: jest.fn(async () => rows) },
    loggerImpl: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  });

describe("ChatBotAdminUseCases.listReminders", () => {
  it("сериализует список из нескольких напоминаний без падения (map с индексом вместо даты)", async () => {
    const useCases = build([row(3), row(4, { schedule_kind: "daily", last_day_of_month: false })]);

    const items = await useCases.listReminders({});

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("3");
    expect(items[0].next_occurrence).toBeInstanceOf(Date);
    expect(new Date(items[0].next_occurrence).getTime()).toBeGreaterThan(Date.now());
    expect(items[1].id).toBe("4");
  });

  it("неактивное напоминание — без next_occurrence, но тоже без падения", async () => {
    const useCases = build([row(7, { is_active: false })]);

    const items = await useCases.listReminders({});

    expect(items[0].next_occurrence).toBeNull();
  });
});
