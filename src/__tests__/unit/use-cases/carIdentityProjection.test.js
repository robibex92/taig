/* eslint-env jest */
/**
 * Публичная часть реестра авто.
 *
 * Номер, марка, модель и цвет машины публичны — страницей «Чей авто» так и
 * задумано. `user_id` публичным не был: в этом проекте это id Telegram, и в
 * связке с `GET /api/users/:id` он превращал парковку в список «кто где живёт».
 */

import { projectCarForViewer } from "../../../application/use-cases/car/carAccess.js";
import { GetCarsUseCase } from "../../../application/use-cases/car/GetCarsUseCase.js";
import { GetCarByIdUseCase } from "../../../application/use-cases/car/GetCarByIdUseCase.js";
import { GetUserCarsUseCase } from "../../../application/use-cases/car/GetUserCarsUseCase.js";
import { ContactController } from "../../../presentation/controllers/ContactController.js";
import { ForbiddenError } from "../../../core/errors/AppError.js";

const owner = { user_id: 245946670n, roles: [] };
const resident = { user_id: 8n, roles: [] };
const carsAdmin = { user_id: 9n, roles: ["cars:admin"] };
const moderator = { user_id: 1n, roles: ["global:moderator"] };

const car = (userId = 245946670n) => ({
  id: 4n,
  user_id: userId,
  car_number: "Т923ОН54",
  car_brand: "Kia",
  car_model: "Rio",
  car_color: "белый",
  info: null,
  created_at: new Date("2026-01-01"),
  status: true,
  toJSON() {
    const { toJSON, ...row } = this;
    return row;
  },
});

const repository = (row = car()) => ({
  findAll: async () => [row],
  findById: async () => row,
  findByUserId: async () => [row],
});

describe("projectCarForViewer", () => {
  it("гостю и соседу — идентификация машины без владельца", () => {
    for (const viewer of [null, resident]) {
      const row = projectCarForViewer(car(), viewer);

      expect(row).not.toHaveProperty("user_id");
      expect(row).toMatchObject({
        car_number: "Т923ОН54",
        car_brand: "Kia",
        has_owner: true,
        is_owner: false,
      });
    }
  });

  it("машине без владельца нечего прятать", () => {
    const row = projectCarForViewer(car(null), null);

    expect(row).toMatchObject({ has_owner: false, is_owner: false });
  });

  it("владелец, администратор автомобилей и модерация видят привязку", () => {
    for (const viewer of [owner, carsAdmin, moderator]) {
      expect(projectCarForViewer(car(), viewer).user_id).toBe(245946670n);
    }

    expect(projectCarForViewer(car(), owner).is_owner).toBe(true);
    expect(projectCarForViewer(car(), carsAdmin).is_owner).toBe(false);
  });

  it("BigInt владельца и строка из токена совпадают", () => {
    expect(projectCarForViewer(car(), { user_id: "245946670", roles: [] }).is_owner).toBe(true);
  });
});

describe("списки машин", () => {
  it("`GET /cars` прячет владельца у чужих", async () => {
    const cars = await new GetCarsUseCase(repository()).execute(resident);

    expect(cars[0]).not.toHaveProperty("user_id");
    expect(cars[0].has_owner).toBe(true);
  });

  it("`GET /cars/:id` тот же уровень выдачи", async () => {
    const row = await new GetCarByIdUseCase(repository()).execute(4, null);

    expect(row).not.toHaveProperty("user_id");
  });

  it("список машин человека больше не публичный", async () => {
    const useCase = new GetUserCarsUseCase(repository());

    await expect(useCase.execute("245946670", resident)).rejects.toBeInstanceOf(
      ForbiddenError
    );
    await expect(useCase.execute("245946670", null)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("свой список и список администратора работают", async () => {
    const useCase = new GetUserCarsUseCase(repository());

    expect(await useCase.execute("245946670", owner)).toHaveLength(1);
    expect(await useCase.execute("245946670", carsAdmin)).toHaveLength(1);
  });
});

describe("«написать владельцу» без чужого id", () => {
  const respond = () => {
    const sent = {};
    return {
      sent,
      res: {
        status: () => ({ json: (body) => Object.assign(sent, body) }),
        json: (body) => Object.assign(sent, body),
      },
      next: (error) => {
        throw error;
      },
    };
  };

  // `asyncHandler` возвращает не промис, а обычную функцию: цепочка обработчика
  // доживает до своих микротасок, поэтому ждём следующий тик цикла событий.
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const build = (carRow) => {
    const seen = [];
    const controller = new ContactController({
      delivery: {
        availability: async (recipient) => {
          seen.push(recipient);
          return recipient?.userId == null
            ? { found: false, telegram: false, max: false }
            : { found: true, telegram: true, max: false };
        },
        deliver: async (args) => {
          seen.push(args);
          return { ok: true, channel: args.channel };
        },
      },
      telegramService: { buildContextMessage: ({ message }) => message },
      db: {
        car: { findUnique: async () => carRow },
        user: { findUnique: async () => ({ username: "stub", telegram_id: 7n }) },
      },
    });

    return { controller, seen };
  };

  it("availability по `car_id` находит владельца сам", async () => {
    const { controller, seen } = build({ user_id: 245946670n });

    await controller.availability({ query: { car_id: "4" } }, respond().res, respond().next);
    await flush();

    expect(seen[0].userId).toBe(245946670n);
  });

  it("машины без владельца — адресата нет, а не авария", async () => {
    const { controller } = build({ user_id: null });
    const answer = respond();

    await controller.availability({ query: { car_id: "4" } }, answer.res, answer.next);
    await flush();

    expect(answer.sent.data).toMatchObject({ found: false });
  });

  it("отправка по `car_id` доходит до доставки", async () => {
    const { controller, seen } = build({ user_id: 245946670n });
    const answer = respond();

    await controller.send(
      { body: { car_id: 4, message: "Здравствуйте", channel: "auto" }, user: resident },
      answer.res,
      answer.next
    );
    await flush();

    const delivered = seen.at(-1);
    expect(delivered.userId).toBe(245946670n);
    expect(answer.sent.success).toBe(true);
  });

  it("прямой `user_id` работает как раньше", async () => {
    const { controller, seen } = build(null);

    await controller.availability({ query: { user_id: "777" } }, respond().res, () => {});
    await flush();

    expect(seen[0]).toEqual({ userId: "777", idTelegram: undefined });
  });
});
