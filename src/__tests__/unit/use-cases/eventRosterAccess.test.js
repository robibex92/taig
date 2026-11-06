/* eslint-env jest */
/**
 * Список записавшихся на событие.
 *
 * `GET /api/events` и `GET /api/events/:id` отдавали `registrations` с именами,
 * ником и `user_id` каждого соседа — анонимно, потому что маршрут был открыт без
 * токена. Публичному календарю нужно число мест, а не кто в них записан; состав
 * виден модерации.
 */

import { jest, describe, it, expect } from "@jest/globals";

const registration = (id, name) => ({
  id: BigInt(id),
  status: "registered",
  registered_at: new Date("2026-11-01T09:00:00.000Z"),
  user: {
    user_id: BigInt(id),
    username: name.toLowerCase(),
    first_name: name,
    last_name: "Соседов",
  },
});

const eventRow = {
  id: 4n,
  title: "Субботник",
  description: "У дома 39",
  event_type: "community",
  location: "Двор",
  start_date: new Date("2026-11-15T08:00:00.000Z"),
  end_date: null,
  max_participants: 20,
  status: "published",
  created_by: 1n,
  created_at: new Date("2026-11-01T08:00:00.000Z"),
  updated_at: new Date("2026-11-01T08:00:00.000Z"),
  image_url: null,
  telegram_chats: [],
  creator: { user_id: 1n, username: "admin", first_name: "Аня", last_name: null },
  registrations: [registration(11, "Иван"), registration(12, "Мария")],
};

const prisma = {
  event: {
    findUnique: jest.fn(async () => eventRow),
    findMany: jest.fn(async () => [eventRow]),
    count: jest.fn(async () => 1),
  },
};

await jest.unstable_mockModule("../../../infrastructure/database/prisma.js", () => ({ prisma }));

const { GetEventByIdUseCase } = await import(
  "../../../application/use-cases/event/GetEventByIdUseCase.js"
);
const { GetEventsUseCase } = await import(
  "../../../application/use-cases/event/GetEventsUseCase.js"
);

const resident = { user_id: 8n, roles: [] };
const moderator = { user_id: 1n, roles: ["global:moderator"] };

const detailFor = (viewer) => new GetEventByIdUseCase().execute(4, viewer);
const listFor = async (viewer) =>
  (await new GetEventsUseCase().execute({}, { page: 0, limit: 10 }, viewer)).events[0];

describe("карточка события", () => {
  it("гостю и жильцу — ни имени, ни user_id", async () => {
    for (const viewer of [null, resident]) {
      const event = await detailFor(viewer);

      expect(event.registrations).toHaveLength(2);
      event.registrations.forEach((reg) => {
        expect(reg.user).toBeNull();
        expect(reg.status).toBe("registered");
      });
    }
  });

  it("модерации — состав целиком", async () => {
    const event = await detailFor(moderator);

    expect(event.registrations[0].user).toMatchObject({
      user_id: 11,
      first_name: "Иван",
    });
  });
});

describe("лента событий", () => {
  it("без модерации записи обезличены, но число мест то же", async () => {
    const event = await listFor(null);

    expect(event.registrations).toHaveLength(2);
    expect(event.registrations[0]).not.toHaveProperty("user");
    expect(event.registrations[0]).toMatchObject({ status: "registered" });
  });

  it("модерация видит участников", async () => {
    const event = await listFor(moderator);

    expect(event.registrations[0].user.first_name).toBe("Иван");
  });
});
