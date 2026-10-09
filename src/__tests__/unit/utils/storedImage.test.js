import { describe, it, expect } from "@jest/globals";

import {
  isStorableFormat,
  needsJpegTranscode,
  storedExtension,
} from "../../../core/utils/storedImage.js";

/**
 * Каким будет имя загруженного файла.
 *
 * Расширение должно соответствовать байтам: `express.static` берёт из него
 * `Content-Type`, а браузер по `image/jpeg` отказывается рисовать HEIC.
 */

describe("storedExtension", () => {
  it("обычные форматы получают своё расширение", () => {
    expect(storedExtension("jpeg")).toBe(".jpg");
    expect(storedExtension("png")).toBe(".png");
    expect(storedExtension("webp")).toBe(".webp");
    expect(storedExtension("gif")).toBe(".gif");
  });

  it("HEIC, AVIF и TIFF после перекодировки становятся jpg", () => {
    for (const format of ["heif", "avif", "tiff"]) {
      expect(needsJpegTranscode(format)).toBe(true);
      expect(storedExtension(format)).toBe(".jpg");
    }
  });

  it("не-картинка не получает расширения вовсе", () => {
    for (const format of [undefined, null, "", "svg", "mp4", "pdf"]) {
      expect(isStorableFormat(format)).toBe(false);
      expect(storedExtension(format)).toBeNull();
    }
  });
});
