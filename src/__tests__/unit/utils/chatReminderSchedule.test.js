/* eslint-env jest */
/**
 * Арифметика расписания напоминаний.
 *
 * Здесь живёт то, что планировщик только исполняет: тот же день месяца в том же
 * поясе, окно догона и — главное — граница между «сервер пропустил момент» и
 * «у напоминания этого момента ещё не было».
 */

import {
  describeOccurrence,
  describeReminderSchedule,
  nextOccurrence,
  reminderStatus,
} from "../../../core/utils/chatReminderSchedule.js";

const NSK = "Asia/Novosibirsk";

const monthly = (overrides = {}) => ({
  schedule_kind: "monthly",
  time_of_day: "10:00",
  weekdays: null,
  day_of_month: null,
  last_day_of_month: true,
  created_at: null,
  ...overrides,
});

/** 31.10.2026 — последний день месяца; 10:00 по Новосибирску = 03:00Z. */
const LAST_DAY_NOON = new Date("2026-10-31T06:00:00Z");

describe("статус напоминания", () => {
  it("в последний день месяца до окна догона считает момент наступившим", () => {
    expect(reminderStatus(monthly(), LAST_DAY_NOON, NSK)).toEqual({
      due: true,
      missed: false,
      key: "2026-10T10:00",
    });
  });

  it("спустя больше трёх часов после момента требует пропустить его", () => {
    const row = monthly({ created_at: new Date("2026-10-01T04:00:00Z") });

    expect(reminderStatus(row, new Date("2026-10-31T10:00:00Z"), NSK).missed).toBe(true);
  });

  it("напоминание, созданное после своего момента, ничего не пропускает", () => {
    const bornLate = monthly({ created_at: new Date("2026-10-31T08:00:00Z") });

    expect(reminderStatus(bornLate, new Date("2026-10-31T10:00:00Z"), NSK)).toEqual({
      due: false,
      missed: false,
      key: null,
    });
  });

  it("число 31 в месяце короче живёт в его последний день", () => {
    const thirtyFirst = monthly({ last_day_of_month: false, day_of_month: 31 });

    // 30.11.2026 — последний день месяца, 31-го числа в нём нет.
    expect(reminderStatus(thirtyFirst, new Date("2026-11-30T06:00:00Z"), NSK).due).toBe(true);
    // а 29-го — не пора
    expect(reminderStatus(thirtyFirst, new Date("2026-11-29T06:00:00Z"), NSK).key).toBeNull();
  });

  it("среди месяца последнее число не срабатывает", () => {
    expect(reminderStatus(monthly(), new Date("2026-11-06T06:00:00Z"), NSK).key).toBeNull();
  });
});

describe("подпись момента по его ключу", () => {
  it("дневный ключ разворачивается в дату с временем", () => {
    expect(describeOccurrence(monthly(), "2026-10-31T10:00")).toBe("31.10.2026, 10:00");
  });

  it("месячный ключ с последним днём указывает на 31 октября", () => {
    expect(describeOccurrence(monthly(), "2026-10T10:00")).toBe("31.10.2026, 10:00");
  });

  it("месячный ключ с 31 числом в коротком месяце тоже указывает на последний день", () => {
    const row = monthly({ last_day_of_month: false, day_of_month: 31 });

    expect(describeOccurrence(row, "2026-02T10:00")).toBe("28.02.2026, 10:00");
  });

  it("пустой или непонятный ключ не подписывается", () => {
    expect(describeOccurrence(monthly(), null)).toBeNull();
    expect(describeOccurrence(monthly(), "не ключ")).toBeNull();
  });
});

describe("ближайшее срабатывание", () => {
  it("после 31 октября показывает 30 ноября, а не 31", () => {
    const next = nextOccurrence(monthly(), LAST_DAY_NOON, NSK);

    expect(next).toEqual(new Date("2026-11-30T03:00:00Z"));
  });

  it("подсказка про 31 число обещает то, что делает код", () => {
    expect(describeReminderSchedule(monthly({ last_day_of_month: false, day_of_month: 31 }))).toBe(
      "31-е число каждого месяца в 10:00 (если месяц короче — в последний день)"
    );
    expect(describeReminderSchedule(monthly({ last_day_of_month: false, day_of_month: 15 }))).toBe(
      "15-е число каждого месяца в 10:00"
    );
  });
});
