/**
 * Расписание напоминаний: пресеты «каждый день», «по дням недели», «раз в месяц
 * (в том числе в последний день)» + локальное время в поясе из `REMINDER_TZ`.
 *
 * Никакого cron-парсера и внешней зависимости: момент срабатывания считается по
 * разбиению дня в нужном поясе через `Intl`, потому что «10 утра» должно значить
 * одно и то же независимо от того, какое время стоит на сервере.
 */

export const REMINDER_SCHEDULE_KINDS = ["daily", "weekly", "monthly"];
export const REMINDER_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Дольше этого срока пропущенное срабатывание не догоняем: напоминание уже неточно. */
export const REMINDER_CATCH_UP_MS = 3 * 60 * 60 * 1000;

/** Сколько дней перебираем в поисках следующего срабатывания (для «раз в 31-е»). */
const NEXT_SEARCH_DAYS = 400;

export const reminderTimeZone = () => process.env.REMINDER_TZ || "Europe/Moscow";

const partsFormatter = (timeZone) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });

const WEEKDAYS = { пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6, вс: 7 };

/** Локальные части момента в поясе: { year, month, day, minutes, weekday }. */
export const zonedParts = (moment, timeZone = reminderTimeZone()) => {
  const collected = {};

  for (const part of partsFormatter(timeZone).formatToParts(moment)) {
    collected[part.type] = part.value;
  }

  return {
    year: Number(collected.year),
    month: Number(collected.month),
    day: Number(collected.day),
    minutes: Number(collected.hour) * 60 + Number(collected.minute),
    weekday: WEEKDAYS[String(collected.weekday).toLowerCase()] ?? null,
    date: `${collected.year}-${collected.month}-${collected.day}`,
  };
};

const timeToMinutes = (value) => {
  const [hours, minutes] = String(value).split(":").map(Number);

  return hours * 60 + minutes;
};

/** Момент «день D, время HH:MM в поясе» как абсолютный timestamp. */
export const zonedTimeToUtc = (date, time, timeZone = reminderTimeZone()) => {
  const [year, month, day] = date.split("-").map(Number);
  // Целевое локальное время, сначала наивным образом прочитанное как UTC.
  const target = Date.UTC(year, month - 1, day, 0, timeToMinutes(time));
  let guess = target;

  // Смещение пояса уточняем двумя итерациями: хватает и для обычных поясов, и
  // для тех, где переход через полдень. Сравнение «wall-clock как UTC минус
  // сам момент» даёт именно смещение пояса, а не разницу двух рамок.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, parts.minutes);
    const next = target - (wallClockAsUtc - guess);

    if (next === guess) break;
    guess = next;
  }

  return new Date(guess);
};

/** Полдень местного дня как якорь: полночь в минусовых поясах показывается
 *  предыдущим днём, а полдень всегда попадает в тот же календарный день. */
const dayAnchor = (parts) => Date.UTC(parts.year, parts.month - 1, parts.day, 12);

/** Последний ли это день месяца в поясе (без вычисления длины месяца вручную). */
const isLastDayOfMonth = (parts, timeZone) => {
  const tomorrow = zonedParts(new Date(dayAnchor(parts) + 86_400_000), timeZone);

  return tomorrow.day === 1 || tomorrow.month !== parts.month;
};

const weekdayList = (value) =>
  String(value ?? "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);

/** Совпадает ли напоминание с этим днём (время не смотрим). */
const matchesDay = (reminder, parts, timeZone) => {
  if (reminder.schedule_kind === "daily") return true;

  if (reminder.schedule_kind === "weekly") {
    return weekdayList(reminder.weekdays).includes(parts.weekday);
  }

  if (reminder.last_day_of_month) return isLastDayOfMonth(parts, timeZone);

  return Number(reminder.day_of_month) === parts.day;
};

/** Ключ срабатывания: день для daily/weekly, месяц для monthly. */
export const occurrenceKey = (reminder, parts) => {
  const day = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

  if (reminder.schedule_kind === "monthly") {
    return `${day.slice(0, 7)}T${reminder.time_of_day}`;
  }

  return `${day}T${reminder.time_of_day}`;
};

/**
 * Пора ли отправлять сейчас.
 * @returns {{ due: boolean, missed: boolean, key: string|null }}
 */
export const reminderStatus = (reminder, now = new Date(), timeZone = reminderTimeZone()) => {
  const parts = zonedParts(now, timeZone);
  const key = occurrenceKey(reminder, parts);

  if (!matchesDay(reminder, parts, timeZone)) return { due: false, missed: false, key: null };

  const scheduled = zonedTimeToUtc(parts.date, reminder.time_of_day, timeZone).getTime();
  const elapsed = now.getTime() - scheduled;

  // elapsed < 0 — время ещё не наступило; > окна догона — момент упущен,
  // позже напоминание терять нельзя (оно станет неактуальным).
  if (elapsed < 0) return { due: false, missed: false, key };
  if (elapsed > REMINDER_CATCH_UP_MS) return { due: false, missed: true, key };

  return { due: true, missed: false, key };
};

/** Следующий момент срабатывания — для предпросмотра в админке. */
export const nextOccurrence = (reminder, from = new Date(), timeZone = reminderTimeZone()) => {
  const start = zonedParts(from, timeZone);
  const anchor = dayAnchor(start);

  for (let offset = 0; offset <= NEXT_SEARCH_DAYS; offset += 1) {
    const parts = zonedParts(new Date(anchor + offset * 86_400_000), timeZone);

    if (!matchesDay(reminder, parts, timeZone)) continue;

    const moment = zonedTimeToUtc(parts.date, reminder.time_of_day, timeZone);

    if (moment.getTime() > from.getTime()) return moment;
  }

  return null;
};

/**
 * Проверка расписания из админки. Возвращает нормализованный набор полей:
 * лишнее для выбранного пресета обнуляется, чтобы в БД не лежал противоречивый
 * гибрид «последний день + 15 число».
 */
export const validateReminderSchedule = ({ scheduleKind, timeOfDay, weekdays, dayOfMonth, lastDayOfMonth }) => {
  const kind = String(scheduleKind ?? "").trim();

  if (!REMINDER_SCHEDULE_KINDS.includes(kind)) {
    throw new Error(`Неизвестный тип расписания: ${kind}`);
  }

  const time = String(timeOfDay ?? "").trim();

  if (!REMINDER_TIME_RE.test(time)) {
    throw new Error("Время нужно в формате ЧЧ:ММ, например 10:00");
  }

  if (kind === "weekly") {
    const days = [...new Set(weekdayList(weekdays))].sort((a, b) => a - b);

    if (!days.length) throw new Error("Выберите хотя бы один день недели");

    return {
      schedule_kind: kind,
      time_of_day: time,
      weekdays: days.join(","),
      day_of_month: null,
      last_day_of_month: false,
    };
  }

  if (kind === "monthly") {
    const lastDay = lastDayOfMonth === true || lastDayOfMonth === "true";
    const day = Number(dayOfMonth);

    if (lastDay) {
      return {
        schedule_kind: kind,
        time_of_day: time,
        weekdays: null,
        day_of_month: null,
        last_day_of_month: true,
      };
    }

    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error("Для «раз в месяц» нужен день 1..31 или последний день месяца");
    }

    return {
      schedule_kind: kind,
      time_of_day: time,
      weekdays: null,
      day_of_month: day,
      last_day_of_month: false,
    };
  }

  return {
    schedule_kind: kind,
    time_of_day: time,
    weekdays: null,
    day_of_month: null,
    last_day_of_month: false,
  };
};

/** Человекочитаемое описание расписания — показывается в списке админки. */
const WEEKDAY_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export const describeReminderSchedule = (reminder) => {
  const time = reminder.time_of_day;

  if (reminder.schedule_kind === "daily") return `каждый день в ${time}`;

  if (reminder.schedule_kind === "weekly") {
    const days = weekdayList(reminder.weekdays).map((day) => WEEKDAY_LABELS[day - 1]).join(", ");

    return `по дням: ${days} в ${time}`;
  }

  return reminder.last_day_of_month
    ? `последний день месяца в ${time}`
    : `${reminder.day_of_month}-е число каждого месяца в ${time}`;
};

export default {
  reminderTimeZone,
  reminderStatus,
  nextOccurrence,
  validateReminderSchedule,
  describeReminderSchedule,
};
