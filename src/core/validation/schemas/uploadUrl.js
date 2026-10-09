import Joi from "joi";

/**
 * Ссылка на файл из нашего каталога загрузок — и только.
 *
 * `image_url` уходит в карточку объявления, в новость и в событие, а фронт
 * подставляет его прямо в `src`. Разрешить произвольный домен — значит позволить
 * подставить в чужое объявление картинку с чужого сервера (и пережить её исчезновение),
 * а `javascript:`/`data:` в `src` — это уже не про эстетику.
 *
 * Форма ссылки исторически разная: `/uploads/<file>`, `/api/uploads/<file>` и
 * абсолютный адрес с `/api-v1/uploads/<file>` — все три соответствуют действительности.
 */

const UPLOAD_PATH = /(^|\/)(api\/)?uploads\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;

export const isOwnUploadUrl = (value) => {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.includes("..")) return false;

  // `//evil.example/uploads/1.jpg` браузер читает как чужой хост с текущей схемой.
  if (value.startsWith("//")) return false;

  const absolute = /^https?:\/\//i.test(value);

  if (!absolute) return UPLOAD_PATH.test(`/${value.replace(/^\/+/, "")}`);

  try {
    const url = new URL(value);

    // Хост сверять с `API_URL` нельзя: файлы могут быть записаны и с адресом
    // запроса (`buildServerUrl` без env). Достаточно требования, что путь ведёт
    // в каталог загрузок — чужой домен с таким путём отдаст 404, а не чужой контент.
    return UPLOAD_PATH.test(url.pathname);
  } catch {
    return false;
  }
};

export const ownUploadUrl = () =>
  Joi.string()
    .custom((value, helpers) =>
      isOwnUploadUrl(value) ? value : helpers.error("any.onlyUpload")
    )
    .messages({
      "any.onlyUpload": "Можно ссылать только на файл из каталога загрузок",
    });
