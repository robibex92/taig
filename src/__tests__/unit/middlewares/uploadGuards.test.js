import { describe, it, expect } from "@jest/globals";

import { imageFileFilter } from "../../../core/middlewares/uploadMiddleware.js";
import { errorHandler } from "../../../core/middlewares/errorHandler.js";
import { ValidationError } from "../../../core/errors/AppError.js";

/**
 * Что пускают в `uploads/`.
 *
 * Каталог раздаётся с того же origins, что и приложение, поэтому неподходящий
 * файл здесь — не «мусор на диске», а исполняемый контент для посетителей сайта.
 */

const runFilter = (mimetype) =>
  new Promise((resolve) => {
    imageFileFilter({}, { mimetype }, (error, accepted) => resolve({ error, accepted }));
  });

describe("imageFileFilter", () => {
  it("принимает растровые снимки, регистр mime не важен", async () => {
    expect(await runFilter("IMAGE/JPEG")).toEqual({ error: null, accepted: true });
    expect((await runFilter("image/webp")).accepted).toBe(true);
  });

  it("отвергает SVG и всё, что не изображение", async () => {
    for (const mimetype of ["image/svg+xml", "application/x-executable", "text/html"]) {
      const { error, accepted } = await runFilter(mimetype);

      expect(accepted).toBeUndefined();
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
    }
  });

  it("пустой mime — тоже отказ", async () => {
    expect((await runFilter(undefined)).error).toBeInstanceOf(ValidationError);
  });
});

describe("errorHandler про multer", () => {
  const respond = (err) => {
    const codes = [];

    errorHandler(err, { path: "/api/upload", method: "POST", ip: "127.0.0.1" }, {
      status(code) {
        codes.push(code);
        return this;
      },
      json: () => {},
    }, () => {});

    return codes[0];
  };

  it("слишком большой файл — 400, а не 500", () => {
    const error = Object.assign(new Error("File too large"), {
      name: "MulterError",
      code: "LIMIT_FILE_SIZE",
    });

    expect(respond(error)).toBe(400);
  });
});
