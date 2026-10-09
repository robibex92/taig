import {
  AuthorizationError,
  NotFoundError,
} from "../../../core/errors/AppError.js";
import { isModerator } from "../../../core/utils/roles.js";

/** `user_id` из Prisma — BigInt, из токена и тела запроса — строка/число. */
const sameId = (left, right) => String(left ?? "") === String(right ?? "");

/**
 * Право менять фотографии объявления или заметки.
 *
 * Операций четыре — добавить, удалить одну, удалить несколько, сделать
 * главной, — и вход у них разный: где-то id объявления в теле, где-то только id
 * картинки. Поэтому проверка живёт здесь, а не в четырёх контроллерах:
 * снимки объявления правит его автор или модерация, снимки заметки — только
 * модерация.
 */

export const assertCanEditAd = async (adRepository, adId, user) => {
  const ad = await adRepository.findById(adId);

  if (!ad) {
    throw new NotFoundError("Ad");
  }

  if (!sameId(ad.user_id, user?.user_id) && !isModerator(user)) {
    throw new AuthorizationError(
      "Фотографии можно менять только в своём объявлении"
    );
  }

  return ad;
};

export const assertCanEditPost = async (postRepository, postId, user) => {
  const post = await postRepository.findById(postId);

  if (!post) {
    throw new NotFoundError("Post");
  }

  if (!isModerator(user)) {
    throw new AuthorizationError(
      "Фотографии заметок правит только администрация"
    );
  }

  return post;
};

/**
 * Проверка по уже найденным строкам `ad_images`.
 *
 * Цель берётся из записи, а не из тела запроса: клиент может подставить чужой
 * `ad_id`, и доверять ему нельзя.
 */
export const assertCanEditImages = async (
  { adRepository, postRepository },
  images,
  user
) => {
  const adIds = new Set(images.map((image) => image.ad_id).filter((id) => id != null));
  const postIds = new Set(
    images.map((image) => image.post_id).filter((id) => id != null)
  );

  for (const adId of adIds) {
    await assertCanEditAd(adRepository, adId, user);
  }

  for (const postId of postIds) {
    await assertCanEditPost(postRepository, postId, user);
  }

  // Снимок без хозяина (ни объявления, ни заметки) правит только модерация:
  // легаси-строки такие встречаются.
  if (
    images.some((image) => image.ad_id == null && image.post_id == null) &&
    !isModerator(user)
  ) {
    throw new AuthorizationError("Фотографии правит только администрация");
  }
};
