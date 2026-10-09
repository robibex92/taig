import { listHouseRoles } from "../../../core/utils/roles.js";

/**
 * Use case for getting ads with filters and pagination
 */
export class GetAdsUseCase {
  constructor(adRepository, userRepository) {
    this.adRepository = adRepository;
    this.userRepository = userRepository;
  }

  /**
   * `viewer` нужен только фильтром «объявления моего дома»: дома читается из
   * ролей смотрителя (`house:<n>:view|manage`), а не из параметра запроса, —
   * иначе любой мог бы подставить `?house=5` и вычитать чужой дом.
   *
   * @param {{onlyMyHouse?: boolean}} filters
   * @param {{user_id: bigint|string, roles?: string[]}|null} viewer
   */
  async execute(filters = {}, pagination = {}, viewer = null) {
    const { onlyMyHouse, ...rest } = filters;

    if (!onlyMyHouse) {
      return this.adRepository.findAll(rest, pagination);
    }

    const houses = [...new Set(listHouseRoles(viewer).map((entry) => entry.house))];

    if (houses.length === 0) {
      return this.#emptyPage(pagination);
    }

    const authorIds = await this.userRepository.findResidentIdsByHouses(houses);

    return this.adRepository.findAll({ ...rest, authorIds }, pagination);
  }

  /**
   * Жителю без домовой роли показывать «весь дом» нельзя, и врать про пустоту
   * тоже: страница отвечает пустой страницей с честным нулём.
   */
  #emptyPage(pagination) {
    const page = Number(pagination.page ?? 1);
    const limit = Number(pagination.limit ?? 20);

    return { ads: [], total: 0, page, limit, totalPages: 0 };
  }
}
