/**
 * Приведение строк Prisma (BigInt/Date) к плоскому JSON-ответу API.
 *
 * BigInt в этом проекте сериализруется глобальным `BigInt.prototype.toJSON`
 * (см. src/server.js), но контроллеры не должны зависеть от этого:
 * здесь id явно превращаются в строки, а даты — в ISO.
 */

export const idToPlain = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  return String(value);
};

export const dateToIso = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const briefName = (user) => {
  if (!user) return null;
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    null
  );
};

export const mapInboxRow = (row, userIndex = new Map()) => {
  const localUser = row.user_id ? userIndex.get(idToPlain(row.user_id)) : null;

  return {
    id: idToPlain(row.id),
    direction: row.direction,
    max_user_id: idToPlain(row.max_user_id),
    user_id: idToPlain(row.user_id),
    display_name: row.display_name,
    username: row.username,
    text: row.text,
    received_at: dateToIso(row.received_at),
    marker: idToPlain(row.marker),
    is_handled: row.is_handled,
    handled_by: idToPlain(row.handled_by),
    handled_at: dateToIso(row.handled_at),
    note: row.note,
    // Совпавший локальный аккаунт (null — житель не привязан к сайту)
    local_user: localUser
      ? {
          user_id: idToPlain(localUser.user_id),
          name: briefName(localUser),
          username: localUser.username ?? null,
          avatar: localUser.avatar ?? null,
        }
      : null,
    sender_label:
      briefName(localUser) ||
      row.display_name ||
      (row.username ? `@${row.username}` : null) ||
      `MAX id ${idToPlain(row.max_user_id)}`,
    account_linked: Boolean(localUser),
  };
};

export const mapBroadcast = (row, creatorIndex = new Map()) => ({
  id: idToPlain(row.id),
  text: row.text,
  audience: row.audience,
  status: row.status,
  total: row.total,
  sent: row.sent,
  failed: row.failed,
  skipped: row.skipped,
  created_by: idToPlain(row.created_by),
  created_by_name:
    (creatorIndex.get(idToPlain(row.created_by)) &&
      briefName(creatorIndex.get(idToPlain(row.created_by)))) ||
    null,
  created_at: dateToIso(row.created_at),
  started_at: dateToIso(row.started_at),
  finished_at: dateToIso(row.finished_at),
  error: row.error,
  progress: row.total ? Math.round(((row.sent + row.failed + row.skipped) / row.total) * 100) : 0,
});

export const mapRecipient = (row, userIndex = new Map()) => {
  const user = row.user_id ? userIndex.get(idToPlain(row.user_id)) : null;

  return {
    id: idToPlain(row.id),
    broadcast_id: idToPlain(row.broadcast_id),
    user_id: idToPlain(row.user_id),
    max_id: idToPlain(row.max_id),
    status: row.status,
    error: row.error,
    sent_at: dateToIso(row.sent_at),
    name:
      briefName(user) ||
      (typeof row.recipient_user?.max_first_name === "string"
        ? row.recipient_user.max_first_name
        : null) ||
      (user?.username ? `@${user.username}` : null),
    account_linked: Boolean(user),
  };
};

/** user_id -> строка user для быстрого сопоставления в памяти. */
export const indexUsersById = (users) => {
  const index = new Map();
  for (const user of users || []) {
    index.set(idToPlain(user.user_id), user);
  }
  return index;
};

export const indexUsersByMaxId = (users) => {
  const index = new Map();
  for (const user of users || []) {
    if (user.max_id === null || user.max_id === undefined) continue;
    index.set(idToPlain(user.max_id), user);
  }
  return index;
};

export default { mapInboxRow, mapBroadcast, mapRecipient, indexUsersById, indexUsersByMaxId };
