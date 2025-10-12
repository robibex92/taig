import { ValidationError } from "../../../core/errors/AppError.js";

/**
 * Use case for getting entrances by house
 */
export class GetEntrancesByHouseUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(house) {
    if (!house) {
      throw new ValidationError("House parameter is required");
    }

    return await this.houseRepository.findEntrancesByHouse(house);
  }
}
