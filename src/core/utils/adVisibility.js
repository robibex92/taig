import { AD_STATUS } from "../constants/index.js";
import { isModerator } from "./roles.js";

/** `user_id` из Prisma — BigInt, из токена — строка/число. */
const sameId = (left, right) => String(left ?? "") === String(right ?? "");

/**
 * Единственное правило видимости объявления.
 *
 * Активное открыто всем, снятое и удалённое — только автору и модерации. Лежит
 * отдельно от use-case, потому что его проверяют и сама карточка, и её
 * фотографии: иначе ссылка на снятое объявление продолжала бы отдавать снимки.
 */
export const canSeeAd = (ad, viewer = null) => {
  if (!ad) return false;
  if (ad.status === AD_STATUS.ACTIVE) return true;

  return Boolean(viewer) && (sameId(viewer.user_id, ad.user_id) || isModerator(viewer));
};
