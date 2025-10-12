/**
 * Use case for getting all unique houses
 */
export class GetUniqueHousesUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute() {
    return await this.houseRepository.findUniqueHouses();
  }
}
