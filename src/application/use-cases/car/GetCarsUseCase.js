/**
 * Use case for getting all cars
 */
export class GetCarsUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute() {
    return await this.carRepository.findAll();
  }
}
