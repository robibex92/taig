import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { ParkingUseCases } from "../../application/use-cases/parking/ParkingUseCases.js";

/**
 * Parking Controller - handles parking-related requests
 */
export class ParkingController {
  constructor() {
    this.parkingUseCases = new ParkingUseCases();
  }

  /**
   * Get all parking spots
   * Detailed data (price, contacts, owner) is included only for parking admins
   */
  getParkingSpots = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.getAllParkingSpots(req.user);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
    });
  });

  /**
   * Get parking spot by ID
   */
  getParkingSpotById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.parkingUseCases.getParkingSpotById(
      Number(id),
      req.user
    );

    if (!result.success) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
    });
  });

  /**
   * Get parking spot history (parking admins only)
   */
  getParkingSpotHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.parkingUseCases.getParkingSpotById(
      Number(id),
      req.user
    );

    if (!result.success) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        spotId: Number(id),
        history: result.data.history || [],
      },
    });
  });

  /**
   * Update parking spot (owner or parking admin)
   */
  updateParkingSpot = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.parkingUseCases.updateParkingSpot(
      Number(id),
      req.body,
      req.user
    );

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      message: "Парковочное место обновлено успешно",
    });
  });

  /**
   * Assign owner to parking spot (guarded by requireRoles in the route)
   */
  assignOwner = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { ownerId } = req.body;

    const result = await this.parkingUseCases.assignOwner(
      Number(id),
      ownerId,
      req.user.user_id
    );

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      message: "Владелец парковочного места назначен",
    });
  });

  /**
   * Get user's parking spots
   */
  getUserParkingSpots = asyncHandler(async (req, res) => {
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: "User not authenticated",
      });
    }

    const result = await this.parkingUseCases.getUserParkingSpots(userId);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
    });
  });

  /**
   * Send message to parking spot owner
   */
  sendMessageToOwner = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const senderId = req.user?.user_id;

    if (!senderId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: "User not authenticated",
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: "Message content is required",
      });
    }

    const result = await this.parkingUseCases.sendMessageToOwner(
      Number(id),
      senderId,
      content.trim()
    );

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result.data,
      // Use-case знает, дошло ли уведомление; «отправлено» без этого было бы неправдой.
      message: result.data.message,
    });
  });

  /**
   * Get parking statistics
   */
  getParkingStats = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.getParkingStats();

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
    });
  });

  /**
   * Legacy methods for backward compatibility
   */
  createParkingSpot = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.createParkingSpot(req.body);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: result.data });
  });

  deleteParkingSpot = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await this.parkingUseCases.deleteParkingSpot(
      parseInt(id),
      req.user
    );

    if (result.success) {
      res.status(HTTP_STATUS.OK).json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  });

  /**
   * Free a parking spot from its owner (parking admin only)
   */
  unassignOwner = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await this.parkingUseCases.unassignOwner(
      Number(id),
      req.user.user_id
    );

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      message: "Место свободно",
    });
  });

  /**
   * Service notes of one parking spot (staff only)
   */
  getSpotNotes = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.getSpotNotes(
      Number(req.params.id),
      req.user
    );

    if (!result.success) {
      return res
        .status(result.status || HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, error: result.error });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, data: result.data });
  });

  /**
   * Add a service note to a parking spot (staff only)
   */
  addSpotNote = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.addSpotNote(
      Number(req.params.id),
      req.body?.note,
      req.user
    );

    if (!result.success) {
      return res
        .status(result.status || HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, error: result.error });
    }

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: result.data });
  });

  /**
   * Delete a service note (staff only)
   */
  deleteSpotNote = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.deleteSpotNote(
      Number(req.params.noteId),
      req.user
    );

    if (!result.success) {
      return res
        .status(result.status || HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, error: result.error });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, message: result.message });
  });
}
