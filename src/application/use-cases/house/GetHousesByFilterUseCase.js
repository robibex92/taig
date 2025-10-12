/**
 * Use case for getting houses by filter
 */
export class GetHousesByFilterUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(filters) {
    const houses = await this.houseRepository.findByFilters(filters);

    // Return filtered JSON (without internal fields)
    return houses.map((house) => house.toFilteredJSON());
  }
}
