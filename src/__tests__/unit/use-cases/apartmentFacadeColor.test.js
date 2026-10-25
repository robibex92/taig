import { jest, describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Цвет клетки квартиры в сетке «Сосед, привет».
 *
 * `facade_color` в схеме был всегда, но заполнить его было нечем: эндпоинт
 * раскладки принимал только этаж, колонку и ширину. Проверяется и серверная
 * грань (что принимает валидация), и то, что долетает до репозитория.
 */

import { UpdateApartmentLayoutUseCase } from "../../../application/use-cases/house/UpdateApartmentLayoutUseCase.js";
import { apartmentLayoutSchema } from "../../../core/validation/schemas/house.schema.js";

const admin = { user_id: 1, roles: ["global:admin"] };

const houseRepository = {
  findById: jest.fn(async () => ({ house: "39", number: 12 })),
  updateLayout: jest.fn(async (id, changes) => ({
    toFilteredJSON: () => ({ id, ...changes }),
  })),
};

const useCase = new UpdateApartmentLayoutUseCase(houseRepository);

beforeEach(() => {
  houseRepository.findById.mockClear();
  houseRepository.updateLayout.mockClear();
});

describe("PATCH /nearby/:id/layout с цветом", () => {
  it("одного цвета достаточно, чтобы запрос считался раскладкой", async () => {
    const updated = await useCase.execute(7, { facadeColor: "#a1b2c3" }, admin);

    expect(houseRepository.updateLayout).toHaveBeenCalledWith(7, { facadeColor: "#A1B2C3" });
    expect(updated.toFilteredJSON().facadeColor).toBe("#A1B2C3");
  });

  it("null снимает цвет, а не игнорируется", async () => {
    await useCase.execute(7, { facadeColor: null }, admin);

    expect(houseRepository.updateLayout).toHaveBeenCalledWith(7, { facadeColor: null });
  });

  it("цвет уходит вместе с этажём и шириной одним запросом", async () => {
    await useCase.execute(7, { floor: 5, cellSpan: 2, facadeColor: "#112233" }, admin);

    expect(houseRepository.updateLayout).toHaveBeenCalledWith(7, {
      floor: 5,
      cellSpan: 2,
      facadeColor: "#112233",
    });
  });

  it("мусор вместо цвета отклоняется до записи", async () => {
    await expect(useCase.execute(7, { facadeColor: "red" }, admin)).rejects.toThrow(/hex/i);
    await expect(useCase.execute(7, { facadeColor: "#11223" }, admin)).rejects.toThrow(/hex/i);
    await expect(useCase.execute(7, { facadeColor: "#112233ff" }, admin)).rejects.toThrow(/hex/i);
    expect(houseRepository.updateLayout).not.toHaveBeenCalled();
  });

  it("пустой тело-запрос всё ещё ошибка", async () => {
    await expect(useCase.execute(7, {}, admin)).rejects.toThrow(/хотя бы один параметр/);
  });
});

describe("схема apartmentLayoutSchema", () => {
  it("пропускает корректный HEX и его сброс", () => {
    expect(apartmentLayoutSchema.validate({ facadeColor: "#0F0F0F" }).error).toBeUndefined();
    expect(apartmentLayoutSchema.validate({ facadeColor: null }).error).toBeUndefined();
  });

  it("не пропускает цвет, из которого фронт не соберёт фон", () => {
    expect(apartmentLayoutSchema.validate({ facadeColor: "#fff" }).error).toBeDefined();
    expect(apartmentLayoutSchema.validate({ facadeColor: "red" }).error).toBeDefined();
    expect(apartmentLayoutSchema.validate({ facadeColor: "red; background: url(x)" }).error).toBeDefined();
  });
});
