/**
 * Словарь статусов парковочного места.
 *
 * Живёт в `core`, потому что из него собираются и Joi-схемы слоя presentation,
 * и проекция ответа в application. Фронт держит копию в `services/parkingApi.ts`.
 */
export const PARKING_STATUSES = {
  UNDEFINED: "undefined", // Серое - не определен
  OWNED: "owned", // Зеленое - во владении
  FOR_SALE: "for_sale", // Синее - продается
  FOR_RENT: "for_rent", // Оранжевое - аренда
  MAINTENANCE: "maintenance", // Красное - техническое обслуживание
  RESERVED: "reserved", // Фиолетовое - зарезервировано
};

export const PARKING_COLORS = {
  [PARKING_STATUSES.UNDEFINED]: "#9E9E9E", // Серый
  [PARKING_STATUSES.OWNED]: "#4CAF50", // Зеленый
  [PARKING_STATUSES.FOR_SALE]: "#2196F3", // Синий
  [PARKING_STATUSES.FOR_RENT]: "#FF9800", // Оранжевый
  [PARKING_STATUSES.MAINTENANCE]: "#F44336", // Красный
  [PARKING_STATUSES.RESERVED]: "#9C27B0", // Фиолетовый
};

export const PARKING_STATUS_VALUES = Object.values(PARKING_STATUSES);
