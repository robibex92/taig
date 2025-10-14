import logger from "../../../infrastructure/logger/index.js";

/**
 * Get All Users Use Case
 * Admin endpoint to retrieve all users
 */
export class GetAllUsersUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute({ limit = 50, offset = 0, search = null, role = null }) {
    const filters = {};

    if (search) {
      filters.search = search;
    }

    if (role) {
      filters.status = role;
      logger.info("[GetAllUsersUseCase] Filtering by role", {
        role,
        status: filters.status,
      });
    }

    logger.info("[GetAllUsersUseCase] Executing with filters", {
      limit,
      offset,
      search,
      role,
      filters,
    });

    const users = await this.userRepository.findAll({
      limit,
      offset,
      ...filters,
    });

    logger.info("[GetAllUsersUseCase] Users found", {
      count: users.length,
      total: await this.userRepository.count(filters),
    });

    const total = await this.userRepository.count(filters);

    return {
      users,
      total,
      limit,
      offset,
    };
  }
}
