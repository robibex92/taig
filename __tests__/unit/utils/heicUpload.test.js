import { isHeicBuffer } from "../../../src/core/utils/heicImage.js";
import { imageFileFilter } from "../../../src/core/middlewares/uploadMiddleware.js";

/**
 * HEIC доходит до сервера в трёх видах: с типом `image/heic`, с пустым типом и
 * с `application/octet-stream` — так отдают «Файлы» iOS и часть десктопных
 * браузеров. Поэтому фильтр смотрит на расширение, а `isHeicBuffer` различает
 * настоящий контейнер по бренду ISO-BMFF.
 */

const heicBuffer = (brand) => {
  const bytes = Buffer.alloc(16);
  bytes.writeUInt32BE(16, 0);
  bytes.write("ftyp", 4, "ascii");
  bytes.write(brand, 8, "ascii");

  return bytes;
};

describe("узнавание HEIC", () => {
  it("видит бренд контейнера", () => {
    for (const brand of ["heic", "heix", "heim", "mif1"]) {
      expect(isHeicBuffer(heicBuffer(brand))).toBe(true);
    }
  });

  it("не принимает за HEIC чужой контейнер", () => {
    expect(isHeicBuffer(heicBuffer("isom"))).toBe(false);
    expect(isHeicBuffer(Buffer.from("JPEG\xFF\xD8"))).toBe(false);
    expect(isHeicBuffer(Buffer.alloc(4))).toBe(false);
  });
});

describe("фильтр загружаемых файлов", () => {
  const decide = (file) => {
    let result = null;
    imageFileFilter({}, file, (error, ok) => {
      result = error ? `отказ: ${error.message}` : ok;
    });

    return result;
  };

  it("пускает HEIC без честного MIME, если расширение подходящее", () => {
    expect(decide({ mimetype: "application/octet-stream", originalname: "IMG_1234.HEIC" })).toBe(
      true
    );
    expect(decide({ mimetype: "", originalname: "photo.heif" })).toBe(true);
  });

  it("не пускает произвольный файл с типом octet-stream", () => {
    expect(typeof decide({ mimetype: "application/octet-stream", originalname: "shell.exe" })).toBe(
      "string"
    );
  });

  it("SVG остаётся запрещён", () => {
    expect(typeof decide({ mimetype: "image/svg+xml", originalname: "a.svg" })).toBe("string");
  });
});
