import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";
import { AuthenticationError } from "../../core/errors/AppError.js";

/**
 * Parking Controller — только HTTP: достаёт id из запроса, зовёт кейс и печатает
 * ответ. Ошибку прав и отсутствия записи бросает application-слой (AppError),
 * и `errorHandler` превращает её в 403/404 — коды здесь не угадываются.
 */
export class ParkingController {
  constructor({
    parkingUseCases,
    getSpotNotesUseCase,
    addSpotNoteUseCase,
    deleteSpotNoteUseCase,
  }) {
    this.parkingUseCases = parkingUseCases;
    this.getSpotNotesUseCase = getSpotNotesUseCase;
    this.addSpotNoteUseCase = addSpotNoteUseCase;
    this.deleteSpotNoteUseCase = deleteSpotNoteUseCase;
  }

  getParkingSpots = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.getAllParkingSpots(req.user);

    res.status(HTTP_STATUS.OK).json({ success: true, data: result.data });
  });

  getParkingSpotById = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.getParkingSpotById(req.params.id, req.user);

    res.status(HTTP_STATUS.OK).json({ success: true, data: result.data });
  });

  getParkingSpotHistory = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.getSpotHistory(req.params.id, req.user);

    res.status(HTTP_STATUS.OK).json({ success: true, data: result.data });
  });

  updateParkingSpot = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.updateParkingSpot(
      req.params.id,
      req.body,
      req.user
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      message: "Парковочное место обновлено успешно",
    });
  });

  assignOwner = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.assignOwner(
      req.params.id,
      req.body.ownerId,
      req.user.user_id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      message: "Владелец парковочного места назначен",
    });
  });

  unassignOwner = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.unassignOwner(
      req.params.id,
      req.user.user_id
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      message: "Место свободно",
    });
  });

  getUserParkingSpots = asyncHandler(async (req, res) => {
    if (!req.user?.user_id) {
      throw new AuthenticationError("User not authenticated");
    }

    const result = await this.parkingUseCases.getUserParkingSpots(req.user.user_id);

    res.status(HTTP_STATUS.OK).json({ success: true, data: result.data });
  });

  sendMessageToOwner = asyncHandler(async (req, res) => {
    if (!req.user?.user_id) {
      throw new AuthenticationError("User not authenticated");
    }

    const result = await this.parkingUseCases.sendMessageToOwner(
      req.params.id,
      req.user.user_id,
      req.body.content
    );

    // Use-case знает, дошло ли уведомление; «отправлено» без этого было бы неправдой.
    res
      .status(HTTP_STATUS.CREATED)
      .json({ success: true, data: result.data, message: result.data.message });
  });

  getParkingStats = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.getParkingStats();

    res.status(HTTP_STATUS.OK).json({ success: true, data: result.data });
  });

  createParkingSpot = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.createParkingSpot(req.body);

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: result.data });
  });

  deleteParkingSpot = asyncHandler(async (req, res) => {
    const result = await this.parkingUseCases.deleteParkingSpot(req.params.id, req.user);

    res.status(HTTP_STATUS.OK).json(result);
  });

  /** Служебные заметки администрации о месте — видны только персоналу. */
  getSpotNotes = asyncHandler(async (req, res) => {
    const notes = await this.getSpotNotesUseCase.execute(req.params.id, req.user);

    res.status(HTTP_STATUS.OK).json({ success: true, data: notes });
  });

  addSpotNote = asyncHandler(async (req, res) => {
    const note = await this.addSpotNoteUseCase.execute(
      req.params.id,
      req.body.note,
      req.user
    );

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: note });
  });

  deleteSpotNote = asyncHandler(async (req, res) => {
    const result = await this.deleteSpotNoteUseCase.execute(req.params.noteId, req.user);

    res.status(HTTP_STATUS.OK).json({ success: true, message: result.message });
  });
}
