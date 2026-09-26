import { AuthorizationError } from "../../../core/errors/AppError.js";
import { canViewResidentData } from "../../../core/utils/roles.js";

/**
 * Общие части трёх кейсов заметок: право читать/писать и форма ответа.
 *
 * Маршрут уже закрыт `staffViewer` (тот же `canViewResidentData`), проверка здесь —
 * страховка на случай, если кейс начнут звать из другого места.
 */
export function requireStaffViewer(user) {
  if (!canViewResidentData(user)) {
    throw new AuthorizationError("Not authorized");
  }
}

/**
 * Подпись автора заметки: @username, затем имя из Telegram, затем имя в БД.
 * Если автора в БД уже нет — печатаем его id: «Пользователь» вместо подписи
 * в списке заметок ничего не объясняет.
 */
export function authorLabel(user, fallbackId) {
  if (!user) return `ID ${fallbackId}`;
  if (user.username) return `@${user.username}`;
  return user.telegram_first_name || user.first_name || `ID ${fallbackId}`;
}

/** Форма ответа, которую читает `components/parking/SpotNotesDialog.tsx`. */
export const toNoteResponse = (note, createdByLabel) => ({
  id: Number(note.id),
  spotId: Number(note.spot_id),
  note: note.note,
  createdAt: note.created_at,
  createdByLabel,
});
