import { describe, it, expect } from "@jest/globals";

import { parsePriceNumber, priceToDecimal } from "../../../core/utils/price.js";

/**
 * Правило переноса строки цены в число.
 *
 * Это же правило переписано в SQL (`add_ad_price_value.sql`), и оно же стоит в
 * фронте (`normalizeAdPrice`). Расхождение здесь — это сортировка, которая
 * выдаёт одно, а карточка показывает другое.
 */

describe("parsePriceNumber", () => {
  it("читает то, что реально вводят в форме", () => {
    expect(parsePriceNumber("1200")).toBe(1200);
    expect(parsePriceNumber("1 200 ₽")).toBe(1200);
    expect(parsePriceNumber("1200,50")).toBe(1200.5);
    expect(parsePriceNumber(" 99.99 ")).toBe(99.99);
  });

  it("не является ценой всё, что числом не является", () => {
    expect(parsePriceNumber("Договорная")).toBeNull();
    expect(parsePriceNumber(null)).toBeNull();
    expect(parsePriceNumber(undefined)).toBeNull();
    expect(parsePriceNumber("")).toBeNull();
    expect(parsePriceNumber("б/у")).toBeNull();
  });

  it("дробную часть берёт первую, как parseFloat и SQL", () => {
    expect(parsePriceNumber("1.500")).toBe(1.5);
    expect(parsePriceNumber("12.34.56")).toBe(12.34);
  });
});

describe("priceToDecimal", () => {
  it("отдаёт строку — Decimal в Prisma принимает её без потери копеек", () => {
    expect(priceToDecimal("1 200 ₽")).toBe("1200");
    expect(priceToDecimal("1200,50")).toBe("1200.5");
    expect(priceToDecimal("Договорная")).toBeNull();
  });
});
