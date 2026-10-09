/**
 * Фильтр «только мой дом» на витрине.
 *
 * Дом смотрителя берётся из его ролей, а не из параметров запроса: `?house=5`
 * в открытом адресе означало бы, что любой может вычитать объявления чужого
 * дома. Здесь же — что происходит, когда дома у человека нет вовсе.
 */

import { describe, it, expect, jest } from "@jest/globals";

import { GetAdsUseCase } from "../../../application/use-cases/ad/GetAdsUseCase.js";

const neighbor = (id) => ({ user_id: BigInt(id) });

const setup = ({ residents = [neighbor(11), neighbor(12)], rows = [] } = {}) => {
  const adRepository = { findAll: jest.fn(async () => ({ ads: rows, total: rows.length, page: 1, limit: 20, totalPages: 1 })) };
  const userRepository = { findResidentIdsByHouses: jest.fn(async () => residents.map((r) => r.user_id)) };

  return { adRepository, userRepository, useCase: new GetAdsUseCase(adRepository, userRepository) };
};

const resident = { user_id: 3n, roles: ["house:7:view"] };

describe("GetAdsUseCase — «только мой дом»", () => {
  it("без флага список не трогает соседей и не дёргает пользователей", async () => {
    const { useCase, adRepository, userRepository } = setup();

    await useCase.execute({ status: "active" }, { page: 1, limit: 20 }, resident);

    expect(userRepository.findResidentIdsByHouses).not.toHaveBeenCalled();
    expect(adRepository.findAll.mock.calls[0][0]).toEqual({ status: "active" });
  });

  it("флаг отдаёт объявления жителей того же дома", async () => {
    const { useCase, adRepository, userRepository } = setup();

    await useCase.execute({ status: "active", onlyMyHouse: true }, { page: 1, limit: 20 }, resident);

    expect(userRepository.findResidentIdsByHouses).toHaveBeenCalledWith(["7"]);
    expect(adRepository.findAll.mock.calls[0][0]).toEqual({
      status: "active",
      authorIds: [11n, 12n],
    });
  });

  it("несколько домов у одного человека складываются в один запрос", async () => {
    const { useCase, userRepository } = setup();

    await useCase.execute(
      { onlyMyHouse: true },
      {},
      { user_id: 3n, roles: ["house:7:manage", "house:12:view", "house:7:view"] }
    );

    expect(userRepository.findResidentIdsByHouses).toHaveBeenCalledWith(["7", "12"]);
  });

  it("гостю и жителю без дома — пустая страница, а не вся витрина", async () => {
    const withNoRole = setup();
    const guest = await withNoRole.useCase.execute({ onlyMyHouse: true }, { page: 2, limit: 5 }, null);
    const roleless = await withNoRole.useCase.execute(
      { onlyMyHouse: true },
      { page: 1, limit: 20 },
      { user_id: 4n, roles: ["global:moderator"] }
    );

    expect(guest).toEqual({ ads: [], total: 0, page: 2, limit: 5, totalPages: 0 });
    expect(roleless.total).toBe(0);
    expect(withNoRole.adRepository.findAll).not.toHaveBeenCalled();
  });

  it("дом без соседей-авторов — пустой список, фильтр не снимается", async () => {
    const { useCase, adRepository } = setup({ residents: [] });

    await useCase.execute({ onlyMyHouse: true }, {}, resident);

    expect(adRepository.findAll.mock.calls[0][0].authorIds).toEqual([]);
  });
});
