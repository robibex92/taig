import { prisma } from "../../../infrastructure/database/prisma.js";
import {
  GLOBAL_ROLES,
  SERVICE_ROLES,
  houseViewRole,
  houseManageRole,
} from "../../../core/utils/roles.js";

const ROLE_LABELS = {
  [GLOBAL_ROLES.ADMIN]: "Администратор",
  [GLOBAL_ROLES.MODERATOR]: "Модератор",
  [GLOBAL_ROLES.ACTIVIST]: "Активист",
  [GLOBAL_ROLES.BLOCKED]: "Заблокирован",
  [SERVICE_ROLES.PARKING_ADMIN]: "Администратор паркинга",
  [SERVICE_ROLES.CARS_ADMIN]: "Администратор автомобилей",
};

/**
 * Catalog of assignable roles for the admin panel.
 * House roles are derived from the houses actually present in the database.
 */
export class GetRoleCatalogUseCase {
  async execute() {
    // Те же дома, что показывает «Привет, сосед»: только активные записи.
    const houses = await prisma.house.findMany({
      where: { house: { not: null }, status: true },
      distinct: ["house"],
      select: { house: true },
      orderBy: { house: "asc" },
    });

    const houseKeys = [...new Set(houses.map((h) => String(h.house).trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "ru", { numeric: true })
    );

    return {
      global: Object.values(GLOBAL_ROLES).map((role) => ({ role, label: ROLE_LABELS[role] })),
      services: Object.values(SERVICE_ROLES).map((role) => ({ role, label: ROLE_LABELS[role] })),
      houses: houseKeys.map((house) => ({
        house,
        view: { role: houseViewRole(house), label: `Дом ${house} — просмотр` },
        manage: { role: houseManageRole(house), label: `Дом ${house} — управление` },
      })),
    };
  }
}
