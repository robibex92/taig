import {
  GLOBAL_ROLES,
  houseManageRole,
  houseViewRole,
  isValidRole,
  normalizeHouseKey,
} from "../../../core/utils/roles.js";
import { ValidationError } from "../../../core/errors/AppError.js";

/**
 * Аудитории рассылки MAX-бота.
 *
 * Грамматика селектора (строка приходит из админки, поле `audience`):
 *   all_max            — все жители с заполненным `users.max_id`
 *   role:<роль>        — держатели роли, например `role:global:moderator`
 *                        или `role:house:39:manage` (двоеточия внутри роли допустимы)
 *   house:<номер>      — shortcut: жители дома (роль house:<n>:view ИЛИ house:<n>:manage)
 *
 * Правила безопасности:
 *   - пользователи с ролью `global:blocked` исключаются ВСЕГДА, при любом селекторе;
 *   - получатели без `max_id` в рассылку не попадают физически.
 */

export const MAX_BOT_AUDIENCE_ALL = "all_max";

const AUDIENCE_RE = /^(all_max|role|house)\b/i;

export const parseMaxBotAudience = (raw) => {
  const value = String(raw ?? "").trim();

  if (!value) {
    throw new ValidationError("Не указана аудитория рассылки");
  }

  if (!AUDIENCE_RE.test(value)) {
    throw new ValidationError(
      "Неизвестная аудитория. Доступно: all_max, role:<роль>, house:<номер>"
    );
  }

  const normalized = value.replace(/\s+/g, "");

  if (normalized.toLowerCase() === MAX_BOT_AUDIENCE_ALL) {
    return { kind: MAX_BOT_AUDIENCE_ALL, raw: normalized };
  }

  if (/^role:/i.test(normalized)) {
    const role = normalized.slice("role:".length);

    if (!role) {
      throw new ValidationError("Аудитория «role:» требует названия роли");
    }
    if (!isValidRole(role)) {
      throw new ValidationError(`Недопустимая роль в аудитории: ${role}`);
    }

    return { kind: "role", role, raw: normalized };
  }

  // house:<номер>
  const house = normalizeHouseKey(normalized.slice("house:".length));

  if (!house) {
    throw new ValidationError("Аудитория «house:» требует номера дома, например house:39");
  }

  return { kind: "house", house, raw: normalized };
};

/** Prisma `where` для выборки получателей. Заблокированные исключены всегда. */
export const buildMaxBotAudienceWhere = (parsed) => {
  const audience = parsed ?? parseMaxBotAudience(parsed);
  const notBlocked = { NOT: [{ roles: { has: GLOBAL_ROLES.BLOCKED } }] };
  const hasMaxId = { max_id: { not: null } };

  const roleFilter = (() => {
    if (audience.kind === MAX_BOT_AUDIENCE_ALL) return {};
    if (audience.kind === "role") return { roles: { has: audience.role } };

    return {
      roles: {
        hasSome: [houseViewRole(audience.house), houseManageRole(audience.house)],
      },
    };
  })();

  return {
    AND: [hasMaxId, notBlocked, roleFilter],
  };
};

const displayNameOf = (user) =>
  [user?.max_first_name, user?.first_name, user?.telegram_first_name]
    .map((v) => (typeof v === "string" && v.trim() ? v.trim() : null))
    .find(Boolean) ||
  user?.username ||
  null;

/**
 * Плоский список получателей: `{ user_id, max_id, display_name, username }`.
 * Дедупликация по `max_id` — на случай задвоения аккаунтов.
 */
export const resolveMaxBotAudience = async (db, raw, { limit = null } = {}) => {
  const parsed = typeof raw === "object" && raw !== null ? raw : parseMaxBotAudience(raw);

  const rows = await db.user.findMany({
    where: buildMaxBotAudienceWhere(parsed),
    select: {
      user_id: true,
      max_id: true,
      username: true,
      first_name: true,
      max_first_name: true,
      telegram_first_name: true,
    },
    orderBy: { user_id: "asc" },
    ...(limit ? { take: Number(limit) } : {}),
  });

  const seen = new Set();
  const recipients = [];

  for (const row of rows) {
    const maxId = row.max_id === null || row.max_id === undefined ? null : String(row.max_id);
    if (!maxId || seen.has(maxId)) continue;

    seen.add(maxId);
    recipients.push({
      user_id: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
      max_id: maxId,
      display_name: displayNameOf(row),
      username: row.username ?? null,
    });
  }

  return recipients;
};

export const countMaxBotAudience = async (db, raw) => {
  const parsed = typeof raw === "object" && raw !== null ? raw : parseMaxBotAudience(raw);
  return db.user.count({ where: buildMaxBotAudienceWhere(parsed) });
};

/** Человекочитаемое описание аудитории — для подтверждения отправки в UI. */
export const describeMaxBotAudience = (raw) => {
  const parsed = typeof raw === "object" && raw !== null ? raw : parseMaxBotAudience(raw);

  if (parsed.kind === MAX_BOT_AUDIENCE_ALL) return "все жители с MAX ID";
  if (parsed.kind === "role") return `роль ${parsed.role}`;
  return `дом ${parsed.house}`;
};

export default {
  parseMaxBotAudience,
  buildMaxBotAudienceWhere,
  resolveMaxBotAudience,
  countMaxBotAudience,
  describeMaxBotAudience,
};
