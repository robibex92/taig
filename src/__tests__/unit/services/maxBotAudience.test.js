/* eslint-env jest */
/**
 * Юнит-тесты резолвера аудитории MAX-рассылок.
 *
 * Проверяется самое опасное место модуля: кого именно бот соберётся написать.
 * Инварианты: только незаблокированные, только с MAX ID, без дублей,
 * роль с двоеточиями не режется пополам.
 */

import { jest } from "@jest/globals";
import {
  parseMaxBotAudience,
  buildMaxBotAudienceWhere,
  resolveMaxBotAudience,
  countMaxBotAudience,
  describeMaxBotAudience,
} from "../../../application/use-cases/maxBot/MaxBotAudience.js";

/** Минимальная заглушка Prisma-клиента. */
const makeDb = ({ users = [], count = null } = {}) => ({
  user: {
    findMany: jest.fn(async ({ where }) => {
      void where;
      return users;
    }),
    count: jest.fn(async ({ where }) => {
      void where;
      return count === null ? users.length : count;
    }),
  },
});

const blockedRole = "global:blocked";

describe("parseMaxBotAudience", () => {
  it("понимает all_max независимо от регистра и пробелов", () => {
    expect(parseMaxBotAudience(" ALL_MAX ")).toEqual({ kind: "all_max", raw: "ALL_MAX" });
  });

  it("сохраняет роль целиком, включая двоеточия", () => {
    expect(parseMaxBotAudience("role:house:39:manage")).toEqual({
      kind: "role",
      role: "house:39:manage",
      raw: "role:house:39:manage",
    });
    expect(parseMaxBotAudience("role:global:moderator").role).toBe("global:moderator");
  });

  it("house: — shortcut с нормализацией номера дома", () => {
    expect(parseMaxBotAudience("house: 39/1 ")).toEqual({
      kind: "house",
      house: "39/1",
      raw: "house:39/1",
    });
  });

  it("отклоняет пустоту, неизвестный селектор и несуществующую роль", () => {
    expect(() => parseMaxBotAudience("")).toThrow(/Не указана аудитория/);
    expect(() => parseMaxBotAudience("all")).toThrow(/Неизвестная аудитория/);
    expect(() => parseMaxBotAudience("role:everything")).toThrow(/Недопустимая роль/);
    expect(() => parseMaxBotAudience("house:")).toThrow(/требует номера дома/);
  });
});

describe("buildMaxBotAudienceWhere", () => {
  it("всегда требует MAX ID и исключает заблокированных", () => {
    const where = buildMaxBotAudienceWhere(parseMaxBotAudience("all_max"));

    expect(where.AND[0]).toEqual({ max_id: { not: null } });
    expect(where.AND[1]).toEqual({ NOT: [{ roles: { has: blockedRole } }] });
    expect(where.AND[2]).toEqual({});
  });

  it("role: фильтрует по одной роли", () => {
    const where = buildMaxBotAudienceWhere(parseMaxBotAudience("role:global:activist"));
    expect(where.AND[2]).toEqual({ roles: { has: "global:activist" } });
  });

  it("house: принимает и view, и manage", () => {
    const where = buildMaxBotAudienceWhere(parseMaxBotAudience("house:39"));
    expect(where.AND[2]).toEqual({
      roles: { hasSome: ["house:39:view", "house:39:manage"] },
    });
  });
});

describe("resolveMaxBotAudience", () => {
  const rows = [
    // BigInt-ы как из Prisma
    {
      user_id: 10n,
      max_id: 100n,
      username: "anna",
      first_name: "Анна",
      max_first_name: "Анна (MAX)",
      telegram_first_name: null,
    },
    {
      user_id: 11n,
      max_id: 101n,
      username: null,
      first_name: null,
      max_first_name: "Пётр",
      telegram_first_name: null,
    },
    {
      user_id: 12n,
      max_id: null, // без MAX ID — не получатель
      username: "ghost",
      first_name: "Призрак",
      max_first_name: null,
      telegram_first_name: null,
    },
    {
      user_id: 13n,
      max_id: 100n, // дубль max_id — должен схлопнуться
      username: "anna2",
      first_name: "Анна 2",
      max_first_name: null,
      telegram_first_name: null,
    },
    {
      user_id: 14n,
      max_id: 104n,
      username: null,
      first_name: null,
      max_first_name: null,
      telegram_first_name: null,
    },
  ];

  it("отдаёт строки, отдаёт приоритет имени из MAX и режет дубли", async () => {
    const db = makeDb({ users: rows });
    const recipients = await resolveMaxBotAudience(db, "all_max");

    expect(recipients).toEqual([
      { user_id: "10", max_id: "100", display_name: "Анна (MAX)", username: "anna" },
      { user_id: "11", max_id: "101", display_name: "Пётр", username: null },
      { user_id: "14", max_id: "104", display_name: null, username: null },
    ]);
  });

  it("прокидывает where в Prisma и умеет ограничивать выборку", async () => {
    const db = makeDb({ users: [] });
    await resolveMaxBotAudience(db, "house:39", { limit: 3 });

    const args = db.user.findMany.mock.calls[0][0];
    expect(args.take).toBe(3);
    expect(args.where.AND).toEqual([
      { max_id: { not: null } },
      { NOT: [{ roles: { has: blockedRole } }] },
      { roles: { hasSome: ["house:39:view", "house:39:manage"] } },
    ]);
  });

  it("принимает уже разобранную аудиторию (без повторного парсинга)", async () => {
    const db = makeDb({ users: [] });
    await resolveMaxBotAudience(db, parseMaxBotAudience("role:parking:admin"));

    expect(db.user.findMany.mock.calls[0][0].where.AND[2]).toEqual({
      roles: { has: "parking:admin" },
    });
  });

  it("countMaxBotAudience считает по тому же where", async () => {
    const db = makeDb({ count: 42 });
    const total = await countMaxBotAudience(db, "all_max");

    expect(total).toBe(42);
    expect(db.user.count.mock.calls[0][0].where.AND[1]).toEqual({
      NOT: [{ roles: { has: blockedRole } }],
    });
  });

  it("describeMaxBotAudience даёт человекочитаемое описание", () => {
    expect(describeMaxBotAudience("all_max")).toBe("все жители с MAX ID");
    expect(describeMaxBotAudience("role:global:moderator")).toBe("роль global:moderator");
    expect(describeMaxBotAudience("house:39")).toBe("дом 39");
  });
});
