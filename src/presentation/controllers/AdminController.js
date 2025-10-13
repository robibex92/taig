const { asyncHandler } = require("../../core/middlewares/asyncHandler");

/**
 * Admin Controller
 * Handles admin panel requests
 */
class AdminController {
  constructor({
    getAllUsersUseCase,
    updateUserRoleUseCase,
    getStatisticsUseCase,
  }) {
    this.getAllUsersUseCase = getAllUsersUseCase;
    this.updateUserRoleUseCase = updateUserRoleUseCase;
    this.getStatisticsUseCase = getStatisticsUseCase;
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
   * Update user role
   * PATCH /api-v1/admin/users/:id/role
   */
  updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    const user = await this.updateUserRoleUseCase.execute({
      user_id: parseInt(id),
      new_role: role,
    });

    res.json({
      success: true,
      data: user,
      message: `User role updated to ${role}`,
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
}

module.exports = AdminController;
