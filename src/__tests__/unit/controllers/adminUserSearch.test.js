/* eslint-env jest */
/**
 * Поиск по жителям — телом запроса, а не строкой URL.
 *
 * `GET /api/admin/users?search=Иванов` писал имя, телефон или ник в access.log
 * nginx и в историю браузера администратора. GET остаётся простой-listing'ом
 * страницей, поиск переезжает в `POST /api/admin/users/search`.
 */

import { AdminController } from "../../../presentation/controllers/AdminController.js";
import { adminUserSearchSchema } from "../../../core/validation/schemas/user.schema.js";
import { ValidationError } from "../../../core/errors/AppError.js";

const seen = [];
const controller = new AdminController(
  {
    execute: async (filters) => {
      seen.push(filters);
      return { users: [], total: 0, limit: filters.limit, offset: filters.offset };
    },
  },
  null,
  null,
  null,
  null
);

const call = async (handler, req) => {
  const sent = {};
  let failure = null;

  // `asyncHandler` ошибку не бросает, а отдаёт дальше — забираем её отсюда.
  await handler(
    req,
    { json: (body) => Object.assign(sent, body) },
    (error) => {
      failure = error;
    }
  );

  if (failure) throw failure;
  return sent;
};

describe("GET /admin/users", () => {
  it("листится страницей без поиска", async () => {
    await call(controller.getAllUsers, { query: { limit: "20", offset: "40" } });

    expect(seen.at(-1)).toMatchObject({ limit: 20, offset: 40 });
    expect(seen.at(-1)).not.toHaveProperty("search");
  });

  it("строка поиска в URL отклоняется, а не игнорируется", async () => {
    const error = await call(controller.getAllUsers, {
      query: { search: "Иванов" },
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain("POST /api/admin/users/search");
  });
});

describe("POST /admin/users/search", () => {
  it("фильтры приходят из тела", async () => {
    await call(controller.searchUsers, {
      body: { search: "Иванов", role: "house:39:view", limit: 25, offset: 0 },
    });

    expect(seen.at(-1)).toEqual({
      search: "Иванов",
      role: "house:39:view",
      limit: 25,
      offset: 0,
    });
  });

  it("пустое тело — это список страницей, а не поиск по всему", async () => {
    const { value } = adminUserSearchSchema.validate({}, { stripUnknown: true });

    expect(value).toEqual({ limit: 50, offset: 0 });
  });

  it("чужие поля в фильтре отбрасываются, лимит ограничен", async () => {
    // `stripUnknown` — как в транспортном `validateRequest`.
    const { value } = adminUserSearchSchema.validate(
      { search: "иван", orderBy: "password" },
      { stripUnknown: true }
    );
    expect(value).toEqual({ search: "иван", limit: 50, offset: 0 });

    const tooMany = adminUserSearchSchema.validate({ limit: 10_000 });
    expect(tooMany.error.details[0].path).toEqual(["limit"]);
  });
});
