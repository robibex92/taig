/* eslint-env jest */
/**
 * Слияние аккаунтов (AR-3): одна настоящая транзакция и честный отказ при
 * конфликте уникальности вместо молчаливого удаления данных.
 */

import { jest } from "@jest/globals";

const MODELS = [
  "ad",
  "booking",
  "event",
  "eventRegistration",
  "eventWaitlist",
  "parkingSpot",
  "parkingMessage",
  "car",
  "carImage",
  "houseComment",
  "entranceComment",
  "refreshToken",
];

const buildTx = () => {
  const tx = {
    user: { delete: jest.fn(async () => {}), update: jest.fn(async () => {}) },
    house: { updateMany: jest.fn(async () => ({ count: 0 })) },
  };
  for (const model of MODELS) {
    tx[model] = { updateMany: jest.fn(async () => ({ count: 0 })) };
  }
  return tx;
};

const tx = buildTx();
const prismaMock = {
  $transaction: jest.fn(async (fn) => fn(tx)),
};

jest.unstable_mockModule("../../../infrastructure/database/prisma.js", () => ({
  prisma: prismaMock,
}));

const { LinkPlatformUseCase } = await import(
  "../../../application/use-cases/user/LinkPlatformUseCase.js"
);

const current = { user_id: 1n, roles: ["global:admin"], telegram_id: 10 };
const other = { user_id: 2n, roles: ["resident:house:39"], max_id: "max-2" };

const build = () => {
  const userRepository = {
    findById: jest.fn(async () => ({ user_id: 1n })),
    update: jest.fn(),
  };
  return { userRepository, useCase: new LinkPlatformUseCase(userRepository, {}, {}) };
};

describe("mergeInto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn) => fn(tx));
  });

  it("перенос, удаление и обновление ролей идут в одной транзакции через tx", async () => {
    const { useCase } = build();

    await useCase.mergeInto(current, other);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.ad.updateMany).toHaveBeenCalledWith({
      where: { user_id: 2n },
      data: { user_id: 1n },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { user_id: 2n } });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 1n },
        data: expect.objectContaining({ max_id: "max-2" }),
      })
    );
  });

  it("конфликт уникальности прерывает слияние без удаления данных", async () => {
    const { useCase } = build();
    const conflict = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    tx.ad.updateMany.mockRejectedValueOnce(conflict);

    await expect(useCase.mergeInto(current, other)).rejects.toThrow(
      "Слияние аккаунтов невозможно"
    );

    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("слияние аккаунта с самим собой — no-op", async () => {
    const { useCase } = build();

    const result = await useCase.mergeInto(current, { ...current });

    expect(result).toBe(current);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});