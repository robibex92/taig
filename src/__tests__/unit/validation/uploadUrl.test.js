import { describe, it, expect } from "@jest/globals";

import { isOwnUploadUrl, ownUploadUrl } from "../../../core/validation/schemas/uploadUrl.js";
import { createAdImagesSchema } from "../../../core/validation/schemas/adImage.schema.js";

/**
 * Что можно записать в `image_url`.
 *
 * Ссылка уходит в `src` на сайте, поэтому чужой домен — это чужой контент в
 * чужом объявлении, а `javascript:`/`data:` — то, что браузер попробует выполнить.
 */

describe("isOwnUploadUrl", () => {
  it("принимает все три формы, которыми файлы реально записаны", () => {
    for (const value of [
      "uploads/1759-123.jpg",
      "/uploads/1759-123.jpg",
      "/api/uploads/1759-123.jpg",
      "https://taiginsky.ru/uploads/1759-123.jpg",
      "https://taiginsky.ru/api/uploads/1759-123.jpg",
      "https://taiginsky.ru/api-v1/uploads/1759-123.jpg",
      "/uploads/events/1759-123.jpg",
    ]) {
      expect(isOwnUploadUrl(value)).toBe(true);
    }
  });

  it("отвергает чужие домены, схемы и выход за каталог", () => {
    for (const value of [
      "https://evil.example/photo.jpg",
      "https://taiginsky.ru/photos/1.jpg",
      "//evil.example/uploads/1.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "/uploads/../etc/passwd",
      "uploads/",
      "",
      undefined,
      42,
    ]) {
      expect(isOwnUploadUrl(value)).toBe(false);
    }
  });
});

describe("createAdImagesSchema", () => {
  const payload = (imageUrl) => ({ ad_id: 7, images: [{ image_url: imageUrl }] });

  it("проходит на ссылке нашего каталога", () => {
    expect(createAdImagesSchema.validate(payload("/uploads/1.jpg")).error).toBeUndefined();
  });

  it("не пропускает ссылку на чужой домен", () => {
    const { error } = createAdImagesSchema.validate(payload("https://evil.example/1.jpg"));

    expect(error?.details?.[0].message).toMatch(/каталога загрузок/);
  });
});
