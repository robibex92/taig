/**
 * Имя хранимого файла по фактическому формату картинки.
 *
 * Раньше `multer` дописывал `.jpg` всем файлам без расширения и снимкам HEIC —
 * байты оставались чужими формату, и `express.static` отдавал их с типом
 * `image/jpeg`: браузер такую «картинку» не рисовал, а в карточке висела
 * заглушка. Здесь решение принимает реальный формат, который определит sharp.
 */

const EXTENSION_BY_FORMAT = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  gif: ".gif",
  // Анимация в gif теряется при any перекодировке, поэтому его не трогаем.
};

/** Форматы, которые сервер доводит до JPEG, чтобы фронт и браузер их точно поняли. */
const TRANSCODE_TO_JPEG = new Set(["heif", "avif", "tiff"]);

export const isStorableFormat = (format) =>
  Boolean(format) && (format in EXTENSION_BY_FORMAT || TRANSCODE_TO_JPEG.has(format));

export const needsJpegTranscode = (format) => TRANSCODE_TO_JPEG.has(format);

/**
 * Расширение, под которым файл останется на диске: после перекодировки — `.jpg`,
 * иначе по формату. `null` — формат не картинковый, файл хранить нельзя.
 */
export const storedExtension = (format) => {
  if (!isStorableFormat(format)) return null;

  return needsJpegTranscode(format) ? ".jpg" : EXTENSION_BY_FORMAT[format];
};

/** То, что стоит показать пользователю, когда файл не принимается. */
export const UNSUPPORTED_IMAGE_MESSAGE =
  "Формат файла не поддерживается — приложите JPG, PNG, WEBP или GIF";
