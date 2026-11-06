/* eslint-env jest */
/**
 * Схема ссылки «Источник» новости (аудит 06.11, S13).
 *
 * Фронт ссылку не покажет, но граница должна отклонять её на записи: иначе в
 * базе копить значения, которые когда-нибудь отрендерит другой клиент.
 */

import { createPostSchema, updatePostSchema } from "../../../core/validation/schemas/post.schema.js";

const base = {
  title: "Планёрка двора",
  content: "Собираемся в субботу в одиннадцать у первого подъезда.",
};

describe("source", () => {
  it("принимает http(s) и пустоту", () => {
    expect(createPostSchema.validate({ ...base, source: "https://example.ru/a" }).error).toBeUndefined();
    expect(createPostSchema.validate({ ...base, source: "http://example.ru/a" }).error).toBeUndefined();
    expect(createPostSchema.validate({ ...base, source: "" }).error).toBeUndefined();
    expect(createPostSchema.validate({ ...base, source: null }).error).toBeUndefined();
    expect(updatePostSchema.validate({ source: "https://example.ru/a" }).error).toBeUndefined();
  });

  it("отклоняет javascript: и прочие схемы", () => {
    for (const source of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "example.ru/a",
    ]) {
      const { error } = createPostSchema.validate({ ...base, source });

      expect(error).toBeDefined();
      expect(error.details[0].path).toEqual(["source"]);
    }
  });

  it("сообщение внятно для формы", () => {
    const { error } = createPostSchema.validate({ ...base, source: "javascript:alert(1)" });

    expect(error.details[0].message).toMatch(/http/);
  });
});
