import { NotFoundError } from "../../../core/errors/AppError.js";
import { logger } from "../../../core/utils/logger.js";

/**
 * Use case for unlinking a user from an apartment
 * Complex business logic:
 * - If position=1 and only one record: clear telegram ID
 * - If position=1 and multiple records: move position=2 data to position=1, delete position=2
 * - If position>1: delete record
 */
export class UnlinkUserFromApartmentUseCase {
  constructor(houseRepository) {
    this.houseRepository = houseRepository;
  }

  async execute(houseId, telegramId) {
    // Find the record by ID
    const house = await this.houseRepository.findById(houseId);

    if (!house) {
      throw new NotFoundError("House");
    }

    logger.info("Unlink request", {
      house_id: houseId,
      position: house.position,
      telegram_id: telegramId,
    });

    // Case 1: position = 1
    if (house.position === 1) {
      // Get all records for this apartment
      const allRecords = await this.houseRepository.findAllByApartment(
        house.house,
        house.entrance,
        house.number
      );

      logger.info("Found records for apartment", {
        count: allRecords.length,
        ids: allRecords.map((r) => r.id),
      });

      // Case 1a: Only one record - just clear telegram ID
      if (allRecords.length === 1) {
        await this.houseRepository.clearTelegramId(houseId);

        logger.info("Cleared telegram ID (single record)", {
          house_id: houseId,
        });

        return {
          message: "id_telegram unlinked (single)",
        };
      }

      // Case 1b: Multiple records - move position=2 to position=1
      if (allRecords.length >= 2) {
        const nextRecord = allRecords[1]; // position=2

        // Move position=2's telegram ID to position=1
        await this.houseRepository.updateTelegramId(
          houseId,
          nextRecord.id_telegram
        );

        logger.info("Moved telegram ID from position 2 to position 1", {
          from_id: nextRecord.id,
          to_id: houseId,
          telegram_id: nextRecord.id_telegram,
        });

        // Delete position=2 record
        await this.houseRepository.deleteById(nextRecord.id);

        logger.info("Deleted position 2 record", { house_id: nextRecord.id });

        return {
          message: "position 1 replaced with position 2, position 2 deleted",
        };
      }

      // Shouldn't reach here
      logger.warn("Unexpected state in unlink for position=1", {
        house_id: houseId,
      });
      return { message: "no action for position=1" };
    }

    // Case 2: position > 1 - just delete the record
    await this.houseRepository.deleteById(houseId);

    logger.info("Deleted position > 1 record", {
      house_id: houseId,
      position: house.position,
    });

    return {
      message: "position > 1 record deleted",
    };
  }
}
