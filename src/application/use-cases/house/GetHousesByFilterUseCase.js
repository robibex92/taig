import { canViewHouse } from "../../../core/utils/roles.js";

/**
 * Use case for getting houses by filter
 *
 * Сетка квартир публичная, но не со всеми полями: контакт жильца едет только
 * тем, кому открыт этот дом (`canViewHouse`) — тем же, кому интерфейс показывает
 * саму сетку.
 */
export class GetHousesByFilterUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(filters, viewer = null) {
    const houses = await this.houseRepository.findByFilters(filters);

    return houses.map((house) =>
      house.toFilteredJSON({ withResidentContact: canViewHouse(viewer, house.house) })
    );
  }
}
