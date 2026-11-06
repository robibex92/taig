import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";

/**
 * Admin Controller
 * Handles admin panel requests
 */
export class AdminController {
  constructor(
    getAllUsersUseCase,
    updateUserRolesUseCase,
    getStatisticsUseCase,
    getRoleCatalogUseCase,
    createDatabaseBackupUseCase
  ) {
    this.getAllUsersUseCase = getAllUsersUseCase;
    this.updateUserRolesUseCase = updateUserRolesUseCase;
    this.getStatisticsUseCase = getStatisticsUseCase;
    this.getRoleCatalogUseCase = getRoleCatalogUseCase;
    this.createDatabaseBackupUseCase = createDatabaseBackupUseCase;
  }

  /**
   * Каталог жителей страницей
   * GET /api-v1/admin/users
   *
   * Строки поиска здесь нет намеренно: имя, телефон или ник в query-параметре
   * попадают в access.log nginx и в историю браузера администратора. Ищут —
   * через `POST /api/admin/users/search`.
   */
  getAllUsers = asyncHandler(async (req, res) => {
    const { limit, offset, role, search } = req.query;

    if (search) {
      throw new ValidationError(
        "Поиск по жителям отправляйте телом запроса на POST /api/admin/users/search"
      );
    }

    const result = await this.getAllUsersUseCase.execute({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
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
   * Поиск по каталогу жителей
   * POST /api-v1/admin/users/search
   */
  searchUsers = asyncHandler(async (req, res) => {
    const { limit, offset, search, role } = req.body;

    const result = await this.getAllUsersUseCase.execute({
      limit: limit ?? 50,
      offset: offset ?? 0,
      search: search || null,
      role: role || null,
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

  /**
   * Whole-database backup as a downloadable SQL file.
   * GET /api-v1/admin/backup
   *
   * Тело ответа — сам дамп, поэтому ни `success`, ни JSON-конверта здесь нет.
   */
  downloadBackup = asyncHandler(async (req, res) => {
    const { buffer, filename } = await this.createDatabaseBackupUseCase.execute();

    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  });
}
