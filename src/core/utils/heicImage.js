import sharp from "sharp";
import decode from "heic-decode";

/**
 * Распаковка HEIC/HEIF.
 *
 * `sharp` в обычной сборке (prebuilt libvips) читает заголовок контейнера —
 * `metadata()` отвечает `format: "heif"` и размеры, — но пиксели раскодировать
 * не может: декодера HEVC (libde265) в бинарнике нет, и попытка даёт
 * `bad seek to …`. Проверено 06.10 на трёх настоящих снимках. Поэтому пиксели
 * берёт `libheif-js` (WASM-сборка libheif, libde265 внутри), а JPEG делает
 * sharp — так на диск не попадают байты, которые ни один браузер не покажет.
 *
 * Поворот (`irot`/`imir`) применяет сам libheif при декодировании: у API
 * раздельные `heif_image_handle_get_width` (видимые размеры) и
 * `..._get_ispe_width` (размеры в контейнере). Дополнительный поворот от нас
 * не нужен — второй раз он завалил бы снимок на бок.
 */

/** Четырёхбуквенные бренды ISO-BMFF, под которыми телефон кладёт снимок. */
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "hemh",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
]);

/**
 * Потолок матрицы: RGBA буфер 48-мегапиксельного снимка — это ~195 МБ, и он
 * держится в памяти вместе с самим контейнером. 50 Мп с запасом покрывают
 * iPhone 14/15 Pro в максимальном разрешении, а всё, что больше, — это уже
 * не «фото с телефона», а риск положить процесс.
 */
const MAX_DECODED_PIXELS = 50_000_000;

/**
 * `true`, если buffer — контейнер HEIC/HEIF. Нужен именно разбор байтов:
 * iOS и «Файлы» нередко присылают `application/octet-stream`, а браузер на
 * десктопе вообще не знает типа.
 */
export const isHeicBuffer = (buffer) => {
  if (!buffer || buffer.length < 12) return false;

  const majorBrand = String.fromCharCode(...buffer.subarray(8, 12)).replace(
    "\0",
    " "
  );

  return HEIC_BRANDS.has(majorBrand.trim());
};

/**
 * HEIC → JPEG buffer. Бросает то, что можно показать пользователю: файл либо
 * не снимок вовсе, либо слишком большой, либо раскодировать нечем.
 */
export const decodeHeicToJpeg = async (
  buffer,
  { maxSide = 1920, quality = 85 } = {}
) => {
  if (!isHeicBuffer(buffer)) {
    throw new Error("Не HEIC/HEIF контейнер");
  }

  const { width, height, data } = await decode({ buffer });

  if (!width || !height || width * height > MAX_DECODED_PIXELS) {
    throw new Error(`Слишком большой снимок ${width}x${height}`);
  }

  return sharp(Buffer.from(data), {
    raw: { width, height, channels: 4 },
  })
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, progressive: true })
    .toBuffer();
};
