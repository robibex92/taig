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
   */
  getParkingSpots = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.getAllParkingSpots();

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
    const result = await this.parkingUseCases.getParkingSpotById(Number(id));

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
   * Get parking spot history
   */
  getParkingSpotHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await this.parkingUseCases.getParkingSpotById(Number(id));

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
   * Update parking spot (only owner can update)
   */
  updateParkingSpot = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?.user_id;

    console.log("Update parking spot request:", {
      id,
      updateData,
      userId,
      user: req.user,
      headers: req.headers,
    });

    if (!userId) {
      console.log("User not authenticated for parking spot update");
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: "User not authenticated",
      });
    }

    const result = await this.parkingUseCases.updateParkingSpot(
      Number(id),
      updateData,
      userId
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
   * Assign owner to parking spot (admin only)
   */
  assignOwner = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { ownerId } = req.body;
    const assignedByUserId = req.user?.user_id;

    if (!assignedByUserId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: "User not authenticated",
      });
    }

    // TODO: Add admin check
    // if (req.user.status !== 'admin') {
    //   return res.status(HTTP_STATUS.FORBIDDEN).json({
    //     success: false,
    //     error: 'Only admins can assign parking spot owners'
    //   });
    // }

    const result = await this.parkingUseCases.assignOwner(
      Number(id),
      ownerId,
      assignedByUserId
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
      message: "Сообщение отправлено владельцу парковочного места",
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
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: "User not authenticated",
      });
    }

    const result = await this.parkingUseCases.createParkingSpot(
      req.body,
      userId
    );

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: result.error,
      });
    }

    res.status(HTTP_STATUS.CREATED).json(result);
  });

  deleteParkingSpot = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: "Authentication required",
      });
    }

    const result = await this.parkingUseCases.deleteParkingSpot(
      parseInt(id),
      userId
    );

    if (result.success) {
      res.status(HTTP_STATUS.OK).json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  });

  assignCarToSpot = asyncHandler(async (req, res) => {
    res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({
      success: false,
      error:
        "Car assignment is not implemented. Use updateParkingSpot instead.",
    });
  });

  freeParkingSpot = asyncHandler(async (req, res) => {
    res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({
      success: false,
      error:
        "Freeing parking spots is not implemented. Use updateParkingSpot instead.",
    });
  });
}
