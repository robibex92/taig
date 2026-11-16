/* eslint-env jest */
/**
 * Удаление аккаунта: два режима (purge / anonymize), одна транзакция,
 * личные данные стираются в обоих, публичный контент — по выбору жителя.
 */

import { jest } from "@jest/globals";

const MODELS = [
  "refreshToken",
  "authHandoff",
  "favoriteAd",
  "booking",
  "eventRegistration",
  "eventWaitlist",
  "parkingMessage",
  "parkingSpot",
  "parkingSpotHistory",
  "carImage",
  "maxBotInboxMessage",
  "maxBotBroadcast",
  "maxBotBroadcastRecipient",
  "house",
  "ad",
  "car",
  "event",
  "telegramMessage",
  "adImage",
  "houseComment",
  "entranceComment",
  "eventTelegramChat",
  "carAdminNote",
  "parkingSpotNote",
];

const buildTx = () => {
  const tx = {};
  for (const model of MODELS) {
    tx[model] = {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      updateMany: jest.fn(async () => ({ count: 0 })),
      findMany: jest.fn(async () => []),
    };
  }
  tx.user = { delete: jest.fn(async () => {}) };
  return tx;
};

const tx = buildTx();
const prismaMock = {
  user: {
    findUnique: jest.fn(async () => ({ user_id: 7n, telegram_id: 42n })),
  },
  $transaction: jest.fn(async (fn) => fn(tx)),
};

jest.unstable_mockModule("../../../infrastructure/database/prisma.js", () => ({
  prisma: prismaMock,
}));

const { DeleteAccountUseCase } = await import(
  "../../../application/use-cases/user/DeleteAccountUseCase.js"
);

const useCase = new DeleteAccountUseCase();

describe("DeleteAccountUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn) => fn(tx));
    prismaMock.user.findUnique.mockResolvedValue({ user_id: 7n, telegram_id: 42n });
  });

  it("неизвестный режим отвергается до транзакции", async () => {
    await expect(useCase.execute(7, "whatever")).rejects.toThrow(
      "Режим удаления должен быть purge или anonymize"
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("несуществующий аккаунт не удаляется", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(useCase.execute(7, "purge")).rejects.toThrow("Аккаунт не найден");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("общая часть: сессии, брони, переписка, владелец места и квартира отвязываются", async () => {
    await useCase.execute(7, "anonymize");

    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { user_id: 7n } });
    expect(tx.booking.deleteMany).toHaveBeenCalledWith({ where: { user_id: 7n } });
    expect(tx.parkingMessage.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ sender_id: 7n }, { receiver_id: 7n }] },
    });
    expect(tx.parkingSpot.updateMany).toHaveBeenCalledWith({
      where: { owner_id: 7n },
      data: { owner_id: null },
    });
    expect(tx.house.updateMany).toHaveBeenCalledWith({
      where: { id_telegram: 42 },
      data: { id_telegram: null },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { user_id: 7n } });
  });

  it("purge удаляет контент и зависимые записи без внешних ключей", async () => {
    tx.ad.findMany.mockResolvedValue([{ id: 11n }]);
    tx.car.findMany.mockResolvedValue([{ id: 21n }]);
    tx.event.findMany.mockResolvedValue([{ id: 31n }]);

    await useCase.execute(7, "purge");

    expect(tx.telegramMessage.deleteMany).toHaveBeenCalledWith({
      where: { ad_id: { in: [11n] } },
    });
    expect(tx.adImage.deleteMany).toHaveBeenCalledWith({
      where: { ad_id: { in: [11] } },
    });
    expect(tx.carImage.deleteMany).toHaveBeenCalledWith({
      where: { car_id: { in: [21n] } },
    });
    expect(tx.eventRegistration.deleteMany).toHaveBeenCalledWith({
      where: { event_id: { in: [31n] } },
    });
    expect(tx.ad.deleteMany).toHaveBeenCalledWith({ where: { user_id: 7n } });
    expect(tx.houseComment.deleteMany).toHaveBeenCalledWith({ where: { author_id: 7n } });
    expect(tx.event.deleteMany).toHaveBeenCalledWith({ where: { created_by: 7n } });
    expect(tx.user.delete).toHaveBeenCalled();
  });

  it("anonymize оставляет контент, отвязывая автора, и ничего не удаляет из контента", async () => {
    await useCase.execute(7, "anonymize");

    expect(tx.ad.updateMany).toHaveBeenCalledWith({
      where: { user_id: 7n },
      data: { user_id: null },
    });
    expect(tx.car.updateMany).toHaveBeenCalledWith({
      where: { user_id: 7n },
      data: { user_id: null },
    });
    expect(tx.houseComment.updateMany).toHaveBeenCalledWith({
      where: { author_id: 7n },
      data: { author_id: null },
    });
    expect(tx.entranceComment.updateMany).toHaveBeenCalledWith({
      where: { author_id: 7n },
      data: { author_id: null },
    });
    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: { created_by: 7n },
      data: { created_by: null },
    });

    expect(tx.ad.deleteMany).not.toHaveBeenCalled();
    expect(tx.car.deleteMany).not.toHaveBeenCalled();
    expect(tx.houseComment.deleteMany).not.toHaveBeenCalled();
    expect(tx.event.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.delete).toHaveBeenCalled();
  });

  it("без telegram_id привязка квартиры не трогается", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ user_id: 7n, telegram_id: null });

    await useCase.execute(7, "anonymize");

    expect(tx.house.updateMany).not.toHaveBeenCalled();
  });
});