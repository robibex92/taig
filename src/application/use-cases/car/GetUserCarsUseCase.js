/**
 * Use case for getting cars by user ID
 */
export class GetUserCarsUseCase {
  constructor(carRepository) {
    this.carRepository = carRepository;
  }

  async execute(userId) {
    return await this.carRepository.findByUserId(userId);
  }
}
