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
      filters.role = role;
    }

    logger.debug("[GetAllUsersUseCase] Executing with filters", {
      limit,
      offset,
      hasSearch: Boolean(search),
      role,
    });

    const [users, total] = await Promise.all([
      this.userRepository.findAll({ limit, offset, ...filters }),
      this.userRepository.count(filters),
    ]);

    logger.info("[GetAllUsersUseCase] Users found", {
      count: users.length,
      total,
    });

    return {
      users,
      total,
      limit,
      offset,
    };
  }
}
