import { NotFoundError, AppError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for linking a user to an apartment
 * Complex business logic with position management
 */
export class LinkUserToApartmentUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(house, entrance, number, telegramId) {
    // Find base record (position=1) by house and number
    const baseRecord = await this.houseRepository.findBasePosition(
      house,
      number
    );

    if (!baseRecord) {
      throw new NotFoundError("Base position not found");
    }

    // If position=1 is free (no telegram ID), update it
    if (!baseRecord.id_telegram) {
      const updated = await this.houseRepository.updateTelegramId(
        baseRecord.id,
        telegramId
      );

      logger.info("Updated existing position 1", {
        house,
        number,
        telegram_id: telegramId,
      });

      return {
        message: "Updated existing position 1",
        data: updated,
      };
    }

    // Position 1 is occupied, need to create new position
    // First, verify there's only one position=1 record
    const position1Count = await this.houseRepository.countPosition1Records(
      house,
      number
    );

    if (position1Count > 1) {
      throw new AppError(
        "Database integrity error: multiple position=1 records found for this apartment. Please contact administrator.",
        400
      );
    }

    // Get max position and create new record
    const maxPosition = await this.houseRepository.getMaxPosition(
      house,
      number
    );
    const newPosition = maxPosition + 1;

    // Create new record with data from base position
    const newRecord = await this.houseRepository.create({
      house,
      entrance: baseRecord.entrance,
      floor: baseRecord.floor,
      number,
      position: newPosition,
      facade_color: baseRecord.facade_color,
      info: "",
      status: true,
      id_telegram: telegramId,
    });

    logger.info("Created new position", {
      house,
      number,
      position: newPosition,
      telegram_id: telegramId,
    });

    return {
      message: `Created new position ${newPosition}`,
      data: newRecord,
    };
  }
}
