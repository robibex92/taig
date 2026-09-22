import { asyncHandler } from "../../core/utils/asyncHandler.js";

/**
 * Admin Controller
 * Handles admin panel requests
 */
export class AdminController {
  constructor(
    getAllUsersUseCase,
    updateUserRolesUseCase,
    getStatisticsUseCase,
    getRoleCatalogUseCase
  ) {
    this.getAllUsersUseCase = getAllUsersUseCase;
    this.updateUserRolesUseCase = updateUserRolesUseCase;
    this.getStatisticsUseCase = getStatisticsUseCase;
    this.getRoleCatalogUseCase = getRoleCatalogUseCase;
  }

  /**
   * Get all users
   * GET /api-v1/admin/users
   */
  getAllUsers = asyncHandler(async (req, res) => {
    const { limit, offset, search, role } = req.query;

    const result = await this.getAllUsersUseCase.execute({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      search,
      role,
    });

    res.json({
      success: true,
      data: result.users,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  });

  /**
   * Update user roles
   * PATCH /api-v1/admin/users/:id/roles
   */
  updateUserRoles = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { roles } = req.body;

    const user = await this.updateUserRolesUseCase.execute({
      actor_user_id: req.user.user_id,
      target_user_id: parseInt(id),
      roles,
    });

    res.json({
      success: true,
      data: user,
      message: "User roles updated",
    });
  });

  /**
   * Get system statistics
   * GET /api-v1/admin/statistics
   */
  getStatistics = asyncHandler(async (req, res) => {
    const stats = await this.getStatisticsUseCase.execute();

    res.json({
      success: true,
      data: stats,
    });
  });

  /**
   * Get assignable roles catalog (global, services, per-house)
   * GET /api-v1/admin/roles
   */
  getRoleCatalog = asyncHandler(async (req, res) => {
    const catalog = await this.getRoleCatalogUseCase.execute();

    res.json({
      success: true,
      data: catalog,
    });
  });
}
