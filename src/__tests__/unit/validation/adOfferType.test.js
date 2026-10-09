/* eslint-env jest */
/**
 * Тип предложения: продажа или прокат.
 *
 * Прокат без срока — обещание без условий: сосед не понимает, на сколько он
 * получает вещь. Поэтому для `rent` срок обязателен, а для `sale` его не
 * существует, и правка «прокат → продажа» обязана остаться валидной, когда
 * срок снимается тем же запросом.
 */

import { describe, it, expect } from "@jest/globals";

import { createAdSchema, updateAdSchema } from "../../../core/validation/schemas/ad.schema.js";

const body = (extra) => ({
  user_id: 7,
  title: "Дрель Bosch",
  content: "Аккумуляторная, два аккумулятора в комплекте",
  category: 5,
  ...extra,
});

describe("createAdSchema", () => {
  it("без типа это продажа, и срок не нужен", () => {
    const { value, error } = createAdSchema.validate(body({ price: "1500" }));

    expect(error).toBeUndefined();
    expect(value.offer_type).toBe("sale");
    expect(value.rental_days).toBeUndefined();
  });

  it("прокат без срока не проходит", () => {
    const { error } = createAdSchema.validate(body({ offer_type: "rent" }));

    expect(error.message).toMatch(/срок в днях/);
  });

  it("прокат со сроком проходит, срок читается числом", () => {
    const { value, error } = createAdSchema.validate(body({ offer_type: "rent", rental_days: 3 }));

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ offer_type: "rent", rental_days: 3 });
  });

  it("нулевой и запредельный срок отвергаются", () => {
    expect(createAdSchema.validate(body({ offer_type: "rent", rental_days: 0 })).error.message).toMatch(
      /одного дня/
    );
    expect(
      createAdSchema.validate(body({ offer_type: "rent", rental_days: 400 })).error.message
    ).toMatch(/365/);
  });

  it("посторонний тип предложения отвергается", () => {
    const { error } = createAdSchema.validate(body({ offer_type: "barter" }));

    expect(error.message).toMatch(/offer_type/);
  });
});

describe("updateAdSchema", () => {
  it("правка без типа ничего про прокат не решает", () => {
    const { value, error } = updateAdSchema.validate({ title: "Дрель Bosch GS" });

    expect(error).toBeUndefined();
    expect(value.offer_type).toBeUndefined();
  });

  it("перевод в продажу со снятием срока валиден", () => {
    const { error } = updateAdSchema.validate({ offer_type: "sale", rental_days: null });

    expect(error).toBeUndefined();
  });

  it("перевод в прокат без срока отвергнут", () => {
    const { error } = updateAdSchema.validate({ offer_type: "rent" });

    expect(error.message).toMatch(/срок в днях/);
  });
});
