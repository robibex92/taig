/**
 * Use case for getting car by ID
 */
export class GetCarByIdUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carId) {
    return await this.carRepository.findById(carId);
  }
}
