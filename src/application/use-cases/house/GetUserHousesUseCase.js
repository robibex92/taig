/**
 * Use case for getting all houses for a specific user
 */
export class GetUserHousesUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(telegramId) {
    return await this.houseRepository.findByUserId(telegramId);
  }
}
