/**
 * Use case for updating car
 */
export class UpdateCarUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(carId, updateData) {
    return await this.carRepository.update(carId, updateData);
  }
}
