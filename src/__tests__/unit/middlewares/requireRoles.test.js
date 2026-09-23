/* eslint-env jest */
/**
 * Гварды доступа как они видны маршруту: requireRoles / authorize.
 * БД не поднимается: req.user подставляется так же, как его формирует authenticateJWT.
 */

import express from "express";
import request from "supertest";
import { requireRoles } from "../../../core/middlewares/checkRole.js";
import { AuthorizationError } from "../../../core/errors/AppError.js";
import { errorHandler } from "../../../core/middlewares/errorHandler.js";
import { GLOBAL_ROLES, SERVICE_ROLES } from "../../../core/utils/roles.js";

const asUser = (roles) => (req, _res, next) => {
  req.user = { user_id: 42, roles, username: "resident", first_name: "Тест" };
  next();
};

const buildApp = ({ roles, middleware = requireRoles }) => {
  const app = express();
  app.get("/probe", asUser(roles), middleware(SERVICE_ROLES.PARKING_ADMIN, GLOBAL_ROLES.ADMIN), (_req, res) =>
    res.json({ ok: true })
  );
  // тот же обработчик ошибок, что на проде
  app.use(errorHandler);
  return app;
};

const probe = async (roles, middleware = requireRoles) => {
  const res = await request(buildApp({ roles, middleware })).get("/probe");
  return res.status;
};

describe("requireRoles", () => {
  it("пропускает администратора и администратора паркинга", async () => {
    expect(await probe([GLOBAL_ROLES.ADMIN])).toBe(200);
    expect(await probe([SERVICE_ROLES.PARKING_ADMIN])).toBe(200);
  });

  it("не пропускает модератора, активиста и обычного жителя", async () => {
    expect(await probe([GLOBAL_ROLES.MODERATOR])).toBe(403);
    expect(await probe([GLOBAL_ROLES.ACTIVIST])).toBe(403);
    expect(await probe([])).toBe(403);
  });

  it("домовую роль не считает допуском к сервисной", async () => {
    expect(await probe(["house:39:manage"])).toBe(403);
  });

  it("блокированный пользователь не проходит даже с ролью администратора", async () => {
    expect(await probe([GLOBAL_ROLES.ADMIN, GLOBAL_ROLES.BLOCKED])).toBe(403);
  });

  it("без аутентификации — 401, а не 403", async () => {
    const app = express();
    app.get("/probe", requireRoles(GLOBAL_ROLES.ADMIN), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).get("/probe");
    expect(res.status).toBe(401);
  });

  it("пустой список ролей требует только аутентификации", async () => {
    const app = express();
    app.get("/probe", asUser([]), requireRoles(), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    expect((await request(app).get("/probe")).status).toBe(200);
  });

  it("authorize ведёт себя так же (тот же словарь)", async () => {
    const { authorize } = await import("../../../presentation/middlewares/authMiddleware.js");
    expect(await probe([GLOBAL_ROLES.MODERATOR], authorize)).toBe(403);
    expect(await probe([SERVICE_ROLES.PARKING_ADMIN], authorize)).toBe(200);
  });
});

describe("ForbiddenError", () => {
  it("отдаёт 403 с кодом AUTHORIZATION_ERROR", async () => {
    const app = express();
    app.get("/probe", () => {
      throw new AuthorizationError("Нельзя");
    });
    app.use(errorHandler);

    const res = await request(app).get("/probe");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTHORIZATION_ERROR");
  });
});
