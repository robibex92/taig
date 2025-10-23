import { HTTP_STATUS } from "../../core/constants/index.js";
import { asyncHandler } from "../../core/middlewares/errorHandler.js";

/**
 * Event Controller - handles event-related requests
 */
export class EventController {
  constructor(
    getEventsUseCase,
    getEventByIdUseCase,
    createEventUseCase,
    updateEventUseCase,
    deleteEventUseCase,
    registerForEventUseCase,
    unregisterFromEventUseCase
  ) {
    this.getEventsUseCase = getEventsUseCase;
    this.getEventByIdUseCase = getEventByIdUseCase;
    this.createEventUseCase = createEventUseCase;
    this.updateEventUseCase = updateEventUseCase;
    this.deleteEventUseCase = deleteEventUseCase;
    this.registerForEventUseCase = registerForEventUseCase;
    this.unregisterFromEventUseCase = unregisterFromEventUseCase;
  }

  /**
   * Get all events
   */
  getEvents = asyncHandler(async (req, res) => {
    const { page = 0, limit = 10, status, event_type } = req.query;
    const filters = { status, event_type };
    const pagination = { page: parseInt(page), limit: parseInt(limit) };

    const result = await this.getEventsUseCase.execute(filters, pagination);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.events,
      pagination: result.pagination,
    });
  });

  /**
   * Get event by ID
   */
  getEventById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const event = await this.getEventByIdUseCase.execute(Number(id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: event,
    });
  });

  /**
   * Create new event
   */
  createEvent = asyncHandler(async (req, res) => {
    const eventData = req.body;
    const userId = req.user.user_id;

    const event = await this.createEventUseCase.execute(eventData, userId);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: event,
      message: "Событие создано успешно",
    });
  });

  /**
   * Update event
   */
  updateEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const eventData = req.body;
    const userId = req.user.user_id;
    const userStatus = req.user.status;

    const event = await this.updateEventUseCase.execute(
      Number(id),
      eventData,
      userId,
      userStatus
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: event,
      message: "Событие обновлено успешно",
    });
  });

  /**
   * Delete event
   */
  deleteEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;
    const userStatus = req.user.status;

    await this.deleteEventUseCase.execute(Number(id), userId, userStatus);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Событие удалено успешно",
    });
  });

  /**
   * Register for event (авторизованные + гости)
   */
  registerForEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.user_id || null; // Может быть null для гостей
    const { notes, guest_name, guest_phone, guest_email } = req.body;

    const registration = await this.registerForEventUseCase.execute(
      Number(id),
      userId,
      {
        notes,
        guest_name,
        guest_phone,
        guest_email,
      }
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: registration,
      message: registration.waitlisted
        ? registration.message
        : "Регистрация на событие прошла успешно",
    });
  });

  /**
   * Unregister from event
   */
  unregisterFromEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;

    await this.unregisterFromEventUseCase.execute(Number(id), userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Отмена регистрации на событие прошла успешно",
    });
  });
}
