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
    }

    const users = await this.userRepository.findAll({
      limit,
      offset,
      ...filters,
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
