import { jest, describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Что уезжает наружу из `GET /api/parking-spots` и `GET /api/parking-spots/:id`.
 *
 * Страница паркинга для гостя — обезличенная схема, и этого мало, если бэк всё
 * равно присылает `status` и `hasOwner` на каждое место: по ним восстанавливается
 * и «кто на парковке», и сколько мест продаётся. Поэтому уровни выдачи решает
 * сервер, а не интерфейс. Прод-БД с этой машины недоступна, вместо неё — подставка.
 */

const spotRow = {
  id: 13n,
  spot_number: "14",
  floor: 1,
  section: null,
  status: "owned",
  is_active: true,
  owner_id: 7n,
  price: "1000",
  description: "Место у лифта",
  contact_info: "+37300000000",
  created_at: new Date("2026-09-26T18:11:20.397Z"),
  updated_at: new Date("2026-09-26T18:11:20.397Z"),
  owner: {
    user_id: 7n,
    username: "neighbour",
    first_name: "Иван",
    telegram_id: 100n,
    max_id: null,
  },
};

const prisma = {
  parkingSpot: {
    findMany: jest.fn(async () => [spotRow]),
    findUnique: jest.fn(async () => spotRow),
  },
  parkingSpotHistory: { findMany: async () => [] },
};

await jest.unstable_mockModule(
  "../../../infrastructure/database/prisma.js",
  () => ({ prisma })
);

const { ParkingUseCases } = await import(
  "../../../application/use-cases/parking/ParkingUseCases.js"
);

const useCases = new ParkingUseCases({ delivery: {} });

const neighbor = { user_id: 8n, roles: [] };
const parkingAdmin = { user_id: 9n, roles: ["parking:admin"] };

const listFor = async (viewer) => (await useCases.getAllParkingSpots(viewer)).data[0];
/** Карточка одного места всегда несёт `history` — для сверки полей её снимаем. */
const detailFor = async (viewer) => {
  const spot = (await useCases.getParkingSpotById(13, viewer)).data;
  delete spot.history;
  return spot;
};

describe("выдача парковочных мест по уровням доступа", () => {
  beforeEach(() => {
    prisma.parkingSpot.findMany.mockClear();
    prisma.parkingSpot.findUnique.mockClear();
  });

  it("гость получает только геометрию места — ни статуса, ни владельца", async () => {
    for (const spot of [await listFor(null), await detailFor(null)]) {
      expect(Object.keys(spot).sort()).toEqual(
        ["floor", "id", "section", "spotNumber"].sort()
      );
    }
  });

  it("сосед видит статус и занятость, но не данные жителя", async () => {
    const spot = await listFor(neighbor);

    expect(spot.status).toBe("owned");
    expect(spot.hasOwner).toBe(true);
    expect(spot.price).toBeUndefined();
    expect(spot.description).toBeUndefined();
    expect(spot.contactInfo).toBeUndefined();
    expect(spot.owner).toBeUndefined();
  });

  it("администратор паркинга получает место целиком", async () => {
    const spot = await listFor(parkingAdmin);

    expect(spot.price).toBe("1000");
    expect(spot.owner).toMatchObject({ id: 7, name: "Иван" });
  });

  it("владельцу места открыты его данные, статус виден и ему", async () => {
    const spot = await detailFor({ user_id: 7n, roles: [] });

    expect(spot.status).toBe("owned");
    expect(spot.owner).toMatchObject({ id: 7, name: "Иван" });
  });

  it("список для гостя не тянет владельца запросом к базе", async () => {
    await listFor(null);

    expect(prisma.parkingSpot.findMany.mock.calls[0][0].include).toBeUndefined();
  });
});
