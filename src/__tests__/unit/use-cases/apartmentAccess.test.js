/* eslint-env jest */
/**
 * Право решать, кто привязан к квартире, берётся из токена, а не из тела запроса.
 */

import {
  ownIdentities,
  resolveApartmentSubject,
  assertApartmentBelongsTo,
} from "../../../application/use-cases/house/apartmentAccess.js";

const resident = { user_id: 500, telegram_id: 500, max_id: null, roles: [] };
const maxResident = { user_id: 900, telegram_id: null, max_id: 900, roles: [] };
const admin = { user_id: 1, telegram_id: 1, max_id: null, roles: ["global:admin"] };

describe("resolveApartmentSubject", () => {
  it("принимает собственный идентификатор", () => {
    expect(resolveApartmentSubject(resident, 500)).toBe(500);
    expect(resolveApartmentSubject(maxResident, 900)).toBe(900);
  });

  it("отказывает чужому идентификатору", () => {
    expect(() => resolveApartmentSubject(resident, 777)).toThrow(/только своими/);
  });

  it("админ может действовать за жильца", () => {
    expect(resolveApartmentSubject(admin, 777)).toBe(777);
  });

  it("moderator — не админ в этом смысле", () => {
    const moderator = { user_id: 2, telegram_id: 2, roles: ["global:moderator"] };
    expect(() => resolveApartmentSubject(moderator, 777)).toThrow(/только своими/);
  });

  it("без id в теле берётся идентификатор из токена", () => {
    expect(resolveApartmentSubject(resident, undefined)).toBe(500);
  });

  it("bigint из Prisma сравнивается по значению", () => {
    expect(ownIdentities({ user_id: 12n, telegram_id: null, max_id: null })).toContain(12);
    expect(resolveApartmentSubject({ user_id: 12n, roles: [] }, "12")).toBe(12);
  });
});

describe("assertApartmentBelongsTo", () => {
  it("жильцу отдаётся только его строка реестра", () => {
    expect(assertApartmentBelongsTo({ id_telegram: 500 }, 500, resident)).toBe(500);
    expect(() => assertApartmentBelongsTo({ id_telegram: 777 }, 500, resident)).toThrow(
      /другому аккаунту/
    );
  });

  it("пустая строка — не цель отвязки", () => {
    expect(() => assertApartmentBelongsTo({ id_telegram: null }, 500, resident)).toThrow(
      /не привязан/
    );
  });

  it("админ снимает привязку любого жильца", () => {
    expect(assertApartmentBelongsTo({ id_telegram: 777 }, 500, admin)).toBe(777);
  });
});
