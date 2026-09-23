import { ForbiddenError, NotFoundError } from "../../../core/errors/AppError.js";
import { isAdmin } from "../../../core/utils/roles.js";

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * Identities that count as "this person" in the apartment registry.
 *
 * `houses.id_telegram` historically stores whichever numeric key the account
 * was created with: telegram_id for Telegram logins, and for MAX-only accounts
 * the user_id (which aliases max_id). So ownership is a set, not a field.
 */
export const ownIdentities = (user) =>
  new Set(
    [toNumber(user?.user_id), toNumber(user?.telegram_id), toNumber(user?.max_id)].filter(
      (value) => value !== null
    )
  );

/**
 * Which resident a link/unlink request is about.
 *
 * A resident may only act as themselves; an administrator may act on behalf of
 * a resident (the admin flows pass an explicit id). Anything else is refused —
 * the identity is taken from the token, never from the request body.
 */
export function resolveApartmentSubject(user, requestedIdTelegram) {
  const own = ownIdentities(user);
  const requested = toNumber(requestedIdTelegram);

  if (requested === null) {
    const self = toNumber(user?.user_id);
    if (self === null) throw new ForbiddenError("Нет данных авторизации");
    return self;
  }

  if (own.has(requested)) return requested;

  if (isAdmin(user)) return requested;

  throw new ForbiddenError("Можно управлять только своими квартирами");
}

/** Assert that the registry row belongs to the subject before unlinking it. */
export function assertApartmentBelongsTo(houseRow, subjectIdTelegram, user) {
  const current = toNumber(houseRow?.id_telegram);

  if (current === null) {
    throw new NotFoundError("К квартире не привязан ни один житель");
  }

  if (isAdmin(user)) return current;

  if (current !== subjectIdTelegram) {
    throw new ForbiddenError("Эта квартира привязана к другому аккаунту");
  }

  return current;
}
