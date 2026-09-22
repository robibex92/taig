import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
} from "../../../core/errors/AppError.js";
import { GLOBAL_ROLES, isValidRole, normalizeRoles } from "../../../core/utils/roles.js";

/**
 * Replace a user's role list.
 * Admin only (enforced by the route guard); an admin cannot revoke their own
 * admin role, which would lock everyone out of the panel.
 */
export class UpdateUserRolesUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute({ actor_user_id, target_user_id, roles }) {
    if (!Array.isArray(roles)) {
      throw new ValidationError("roles must be an array of role strings");
    }

    const unknown = roles.filter((role) => !isValidRole(role));
    if (unknown.length) {
      throw new ValidationError(`Unknown role(s): ${unknown.join(", ")}`);
    }

    const clean = normalizeRoles(roles);

    const user = await this.userRepository.findById(target_user_id);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const keepsAdmin = clean.includes(GLOBAL_ROLES.ADMIN);
    if (String(actor_user_id) === String(target_user_id) && !keepsAdmin) {
      throw new AuthorizationError("You cannot remove your own admin role");
    }

    return this.userRepository.setRoles(target_user_id, clean);
  }
}
