import { NotFoundError } from "../../../core/errors/AppError.js";

/**
 * Use case for getting house info
 */
export class GetHouseInfoUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(houseId) {
    const house = await this.houseRepository.findById(houseId);

    if (!house) {
      throw new NotFoundError("House");
    }

    return house.info;
  }
}
