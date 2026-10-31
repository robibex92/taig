/* eslint-env jest */
/**
 * Планировщик напоминаний в чаты.
 *
 * Защищаемое поведение: одно срабатывание = одно сообщение (даже после рестарта
 * процесса), упавшая отправка повторяется, но не до бесконечности, пропущенный
 * из-за простоя момент не отправляется задним числом, а адрес берётся только из
 * реестра чатов.
 */

import { jest } from "@jest/globals";
import { ChatReminderScheduler } from "../../../infrastructure/services/ChatReminderScheduler.js";

const MSK = "Europe/Moscow";

const logger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });

const reminder = (overrides = {}) => ({
  id: 1n,
  platform: "telegram",
  chat_record_id: 3n,
  text: "напоминаю о продлении интернета",
  schedule_kind: "monthly",
  time_of_day: "10:00",
  weekdays: null,
  day_of_month: null,
  last_day_of_month: true,
  is_active: true,
  last_occurrence_key: null,
  last_result: null,
  last_error: null,
  failed_attempts: 0,
  ...overrides,
});

const build = ({ rows = [], chat = { id: 3n, chat_id: "-1001234", name: "Дом 39", thread_id: 7, is_active: true }, maxChat = null, telegramResult = [{ success: true }], maxResult = { ok: true } } = {}) => {
  const repository = {
    list: jest.fn(async () => rows),
    beginOccurrence: jest.fn(async (id, key) => ({ ...rows[0], last_occurrence_key: key })),
    recordSuccess: jest.fn(async () => {}),
    recordFailure: jest.fn(async () => {}),
    recordSkipped: jest.fn(async () => {}),
  };
  const telegramChats = { getById: jest.fn(async () => chat) };
  const maxChats = { getById: jest.fn(async () => maxChat) };
  const telegram = { sendMessage: jest.fn(async () => ({ results: telegramResult })) };
  const max = { sendChatMessage: jest.fn(async () => maxResult) };

  const scheduler = new ChatReminderScheduler({
    repository,
    telegramChats,
    maxChats,
    telegram,
    max,
    loggerImpl: logger(),
    timeZone: MSK,
  });

  return { repository, telegramChats, maxChats, telegram, max, scheduler };
};

/** 31.10.2026 — последний день месяца; время в поясе MSK. */
const AT_10_01 = new Date("2026-10-31T07:01:00Z");

describe("планировщик напоминаний", () => {
  it("в последний день месяца в 10:00 отправляет в чат реестра с его темой", async () => {
    const { scheduler, telegram } = build({ rows: [reminder()] });

    const results = await scheduler.tick({ now: AT_10_01 });

    expect(results).toEqual({ checked: 1, sent: 1, failed: 0, skipped: 0 });
    expect(telegram.sendMessage).toHaveBeenCalledWith({
      message: "напоминаю о продлении интернета",
      chatIds: ["-1001234"],
      threadIds: [7],
      parse_mode: undefined,
    });
  });

  it("ключ срабатывания занимается до отправки, а успех помечается после", async () => {
    const { scheduler, repository } = build({ rows: [reminder()] });

    await scheduler.tick({ now: AT_10_01 });

    expect(repository.beginOccurrence).toHaveBeenCalledWith(1n, "2026-10T10:00");
    expect(repository.recordSuccess).toHaveBeenCalled();
  });

  it("второй тик того же срабатывания ничего не отправляет", async () => {
    const fired = reminder({ last_occurrence_key: "2026-10T10:00", last_result: "sent", failed_attempts: 0 });
    const { scheduler, telegram } = build({ rows: [fired] });

    const results = await scheduler.tick({ now: AT_10_01 });

    expect(results.sent).toBe(0);
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it("неудача повторяется на следующем тике и прекращается после трёх попыток", async () => {
    const failing = reminder({
      last_occurrence_key: "2026-10T10:00",
      last_result: "failed",
      failed_attempts: 1,
    });
    const { scheduler, telegram, repository } = build({
      rows: [failing],
      telegramResult: [{ success: false, error: "Forbidden: bot was kicked" }],
    });

    await scheduler.tick({ now: AT_10_01 });

    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(repository.recordFailure).toHaveBeenCalledWith(1n, "Forbidden: bot was kicked");

    const exhausted = reminder({
      last_occurrence_key: "2026-10T10:00",
      last_result: "failed",
      failed_attempts: 3,
    });
    const second = build({ rows: [exhausted] });

    expect((await second.scheduler.tick({ now: AT_10_01 })).failed).toBe(0);
    expect(second.telegram.sendMessage).not.toHaveBeenCalled();
  });

  it("пропущенный из-за простоя момент помечается skipped и задним числом не шлётся", async () => {
    const { scheduler, repository, telegram } = build({ rows: [reminder()] });

    const results = await scheduler.tick({ now: new Date("2026-10-31T14:00:00Z") });

    expect(results).toEqual({ checked: 1, sent: 0, failed: 0, skipped: 1 });
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(repository.recordSkipped).toHaveBeenCalledWith(1n, "2026-10T10:00");
  });

  it("до 10:00 не отправляет", async () => {
    const { scheduler, telegram } = build({ rows: [reminder()] });

    expect((await scheduler.tick({ now: new Date("2026-10-31T06:00:00Z") })).sent).toBe(0);
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it("в другой день месяца последнее число не срабатывает", async () => {
    const { scheduler, telegram } = build({ rows: [reminder()] });

    expect((await scheduler.tick({ now: new Date("2026-11-05T07:01:00Z") })).sent).toBe(0);
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it("недельное расписание смотрит на день недели в поясе, а не на UTC", async () => {
    // 06.11.2026 — пятница; 07:01Z = 10:01 MSK того же дня.
    const weekly = reminder({
      schedule_kind: "weekly",
      last_day_of_month: false,
      weekdays: "5",
    });
    const { scheduler } = build({ rows: [weekly] });

    expect((await scheduler.tick({ now: new Date("2026-11-06T07:01:00Z") })).sent).toBe(1);

    // суббота — тот же час уже не пятница
    const saturday = build({ rows: [weekly] });

    expect((await saturday.scheduler.tick({ now: new Date("2026-11-07T07:01:00Z") })).sent).toBe(0);
  });

  it("чата нет в реестре или он выключен — это failed с внятной причиной", async () => {
    const missing = build({ rows: [reminder()], chat: null });

    await missing.scheduler.tick({ now: AT_10_01 });
    expect(missing.repository.recordFailure).toHaveBeenCalledWith(1n, "чат Telegram не найден в реестре");

    const off = build({ rows: [reminder()], chat: { id: 3n, chat_id: "-1001", name: "Дом 39", is_active: false } });

    await off.scheduler.tick({ now: AT_10_01 });
    expect(off.repository.recordFailure).toHaveBeenCalledWith(1n, "чат «Дом 39» выключен");
    expect(off.telegram.sendMessage).not.toHaveBeenCalled();
  });

  it("канал max идёт через sendChatMessage по chat_id из реестра", async () => {
    const { scheduler, max } = build({
      rows: [reminder({ platform: "max", chat_record_id: 7n })],
      maxChat: { id: 7n, chat_id: 500100n, name: "Чат дома 39", chat_type: "CHAT", is_active: true },
    });

    const results = await scheduler.tick({ now: AT_10_01 });

    expect(results.sent).toBe(1);
    expect(max.sendChatMessage).toHaveBeenCalledWith("500100", "напоминаю о продлении интернета");
  });

  it("выключенное напоминание в выборку не попадает и тик его не трогает", async () => {
    const repository = {
      list: jest.fn(async () => []),
      beginOccurrence: jest.fn(),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      recordSkipped: jest.fn(),
    };
    const scheduler = new ChatReminderScheduler({
      repository,
      telegram: { sendMessage: jest.fn() },
      max: { sendChatMessage: jest.fn() },
      loggerImpl: logger(),
      timeZone: MSK,
    });

    const results = await scheduler.tick({ now: AT_10_01 });

    expect(results.checked).toBe(0);
    // Фильтр активный делает репозиторий, а не планировщик.
    expect(repository.list).toHaveBeenCalledWith({ activeOnly: true });
  });
});
