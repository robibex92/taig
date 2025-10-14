import {
  NotFoundError,
  ValidationError,
} from "../../../core/errors/AppError.js";
import { USER_ROLES } from "../../../core/constants/index.js";

/**
 * Update User Role Use Case
 * Admin endpoint to change user role/status
 */
export class UpdateUserRoleUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute({ user_id, new_role }) {
    // Validate role
    const validRoles = Object.values(USER_ROLES);
    if (!validRoles.includes(new_role)) {
      throw new ValidationError(
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    // Get user
    const user = await this.userRepository.findById(user_id);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Update role
    const updatedUser = await this.userRepository.updateRole(user_id, new_role);

    return updatedUser;
  }
}
