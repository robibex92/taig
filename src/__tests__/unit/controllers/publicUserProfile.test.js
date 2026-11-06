/* eslint-env jest */
/**
 * Публичный профиль.
 *
 * `GET /api/users/:id` отдавал `username` — ник Telegram — каждому, а id в этом
 * проекте последовательные, так что перебором собирался список «номер → имя →
 * ник». Имя и аватар остаются (ими объявление и подписано), ник — только
 * модерации и самому человеку. Заодно отсутствующий id перестал быть 500.
 */

import { UserEntity } from "../../../domain/entities/User.entity.js";
import { UserController } from "../../../presentation/controllers/UserController.js";
import { NotFoundError, ValidationError } from "../../../core/errors/AppError.js";

const row = new UserEntity({
  user_id: 245946670n,
  username: "vallilonga",
  first_name: "Антон",
  last_name: "Р",
  avatar: "https://t.me/i/userpic/x.jpg",
  telegram_id: 245946670n,
  roles: [],
});

const controller = new UserController(
  null,
  { findById: async (id) => (Number(id) === 245946670 ? row : null) },
  null,
  null
);

const call = async (handler, req) => {
  const sent = {};
  let failure = null;

  const res = {
    json: (body) => Object.assign(sent, body),
    status: () => ({ json: (body) => Object.assign(sent, body) }),
  };

  // `asyncHandler` возвращает обычную функцию: обработчик доживает до своих
  // микротасок, поэтому ждём следующий тик.
  await handler(req, res, (error) => {
    failure = error;
  });
  await new Promise((resolve) => setImmediate(resolve));

  if (failure) throw failure;
  return sent;
};

const profile = (viewer) =>
  call(controller.getUserById, { params: { id: "245946670" }, user: viewer });

describe("GET /api/users/:id", () => {
  it("гость и сосед видят имя, но не ник", async () => {
    for (const viewer of [null, { user_id: 8n, roles: [] }]) {
      const body = await profile(viewer);

      expect(body.data).toMatchObject({ first_name: "Антон", last_name: "Р" });
      expect(body.data).not.toHaveProperty("username");
    }
  });

  it("модерация и сам человек видят ник", async () => {
    expect((await profile({ user_id: 1n, roles: ["global:moderator"] })).data.username).toBe(
      "vallilonga"
    );
    expect((await profile({ user_id: 245946670n, roles: [] })).data.username).toBe(
      "vallilonga"
    );
  });

  it("несуществующий человек — 404, а не 500", async () => {
    const error = await call(controller.getUserById, {
      params: { id: "999999999" },
      user: null,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.statusCode).toBe(404);
  });

  it("не число в параметре — 400, а не падение Prisma", async () => {
    const error = await call(controller.getUserById, {
      params: { id: "abc" },
      user: null,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ValidationError);
  });

  it("аватар несуществующего человека — тоже 404", async () => {
    const error = await call(controller.getUserAvatar, {
      params: { id: "999999999" },
      user: null,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe("UserEntity.toPublicJSON", () => {
  it("без разрешения ник не попадает в объект вообще", () => {
    const json = row.toPublicJSON();

    expect(Object.keys(json)).toEqual(["user_id", "first_name", "last_name", "avatar"]);
  });

  it("с разрешением ник возвращается", () => {
    expect(row.toPublicJSON({ withHandle: true }).username).toBe("vallilonga");
  });
});
