import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError, NotFoundError } from "../../core/errors/AppError.js";
import { buildServerUrl } from "../../core/utils/requestUrl.js";

/**
 * Car Controller
 * Handles HTTP requests for car operations.
 *
 * Валидация входа живёт в маршрутах (`cars.routes.js`), отсутствие записи и прав
 * бросает application-слой (`carAccess.js`) — здесь только разбор запроса и форма
 * ответа. Зависимости передаются по именам: раньше это было 17 позиционных
 * аргументов, и соседняя перестановка в контейнере молча подменяла, например,
 * `updateCarImageUseCase` на `deleteCarImageUseCase`.
 */
export class CarController {
  constructor({
    getCarsUseCase,
    getUserCarsUseCase,
    getCarByIdUseCase,
    createCarUseCase,
    updateCarUseCase,
    deleteCarUseCase,
    getCarImagesUseCase,
    addCarImageUseCase,
    updateCarImageUseCase,
    deleteCarImageUseCase,
    getCarAdminNotesUseCase,
    addCarAdminNoteUseCase,
    updateCarAdminNoteUseCase,
    deleteCarAdminNoteUseCase,
    mergeCarsUseCase,
    assignCarToUserUseCase,
    carImageUploadService,
  }) {
    this.getCarsUseCase = getCarsUseCase;
    this.getUserCarsUseCase = getUserCarsUseCase;
    this.getCarByIdUseCase = getCarByIdUseCase;
    this.createCarUseCase = createCarUseCase;
    this.updateCarUseCase = updateCarUseCase;
    this.deleteCarUseCase = deleteCarUseCase;
    this.getCarImagesUseCase = getCarImagesUseCase;
    this.addCarImageUseCase = addCarImageUseCase;
    this.updateCarImageUseCase = updateCarImageUseCase;
    this.deleteCarImageUseCase = deleteCarImageUseCase;
    this.getCarAdminNotesUseCase = getCarAdminNotesUseCase;
    this.addCarAdminNoteUseCase = addCarAdminNoteUseCase;
    this.updateCarAdminNoteUseCase = updateCarAdminNoteUseCase;
    this.deleteCarAdminNoteUseCase = deleteCarAdminNoteUseCase;
    this.mergeCarsUseCase = mergeCarsUseCase;
    this.assignCarToUserUseCase = assignCarToUserUseCase;
    this.carImageUploadService = carImageUploadService;
  }

  // ============================================
  // CAR IDENTITY (публичная часть)
  // ============================================

  /** GET /api-v1/cars — все активные машины. */
  getAll = asyncHandler(async (req, res) => {
    const cars = await this.getCarsUseCase.execute();

    res.json({ success: true, data: cars });
  });

  /** GET /api-v1/cars/user/:user_id */
  getUserCars = asyncHandler(async (req, res) => {
    const cars = await this.getUserCarsUseCase.execute(req.params.user_id);

    res.json({ success: true, data: cars });
  });

  /** GET /api-v1/cars/:id */
  getById = asyncHandler(async (req, res) => {
    const car = await this.getCarByIdUseCase.execute(req.params.id);

    if (!car) {
      throw new NotFoundError("Car");
    }

    res.json({ success: true, data: car });
  });

  /** PATCH /api-v1/cars/:id — резидент правит свою машину, cars:admin — любую. */
  update = asyncHandler(async (req, res) => {
    const updatedCar = await this.updateCarUseCase.execute(
      req.params.id,
      req.body,
      req.user
    );

    res.json({
      success: true,
      data: updatedCar,
      message: "Car updated successfully",
    });
  });

  /** POST /api-v1/cars */
  create = asyncHandler(async (req, res) => {
    const car = await this.createCarUseCase.execute(req.body, req.user);

    res.status(201).json({ success: true, data: car });
  });

  /** DELETE /api-v1/cars/:id — мягкое удаление. */
  delete = asyncHandler(async (req, res) => {
    await this.deleteCarUseCase.execute(req.params.id, req.user);

    res.status(204).send();
  });

  // ============================================
  // CAR IMAGES (галерея — cars:admin; чтение ещё и владельцу машины)
  // ============================================

  /** GET /api-v1/cars/:id/images */
  getCarImages = asyncHandler(async (req, res) => {
    const images = await this.getCarImagesUseCase.execute(req.params.id, req.user);

    res.json({ success: true, data: images });
  });

  /** POST /api-v1/cars/:id/images — файл из multer или готовая ссылка. */
  addCarImage = asyncHandler(async (req, res) => {
    const { comment, image_url: providedUrl } = req.body;
    let imageUrl = providedUrl;

    if (req.file) {
      imageUrl = this.carImageUploadService.getFileUrl(
        req.file.filename,
        buildServerUrl(req)
      );
      await this.carImageUploadService.processImage(req.file.path);
    }

    // Выбор «файл или ссылка» — вне полномочий Joi: нужно смотреть `req.file`.
    if (!imageUrl) {
      throw new ValidationError("Either image file or image URL is required");
    }

    const image = await this.addCarImageUseCase.execute(
      req.params.id,
      { image_url: imageUrl, comment },
      req.user?.user_id
    );

    res.status(201).json({
      success: true,
      data: image,
      message: "Image added successfully",
    });
  });

  /** PATCH /api-v1/cars/images/:imageId — сейчас только комментарий к фото. */
  updateCarImage = asyncHandler(async (req, res) => {
    const image = await this.updateCarImageUseCase.execute(req.params.imageId, {
      comment: req.body.comment,
    });

    res.json({
      success: true,
      data: image,
      message: "Image updated successfully",
    });
  });

  /** DELETE /api-v1/cars/images/:imageId */
  deleteCarImage = asyncHandler(async (req, res) => {
    const result = await this.deleteCarImageUseCase.execute(req.params.imageId);

    res.json(result);
  });

  // ============================================
  // CAR ADMIN NOTES (cars:admin)
  // ============================================

  /** GET /api-v1/cars/:id/admin-notes */
  getCarAdminNotes = asyncHandler(async (req, res) => {
    const notes = await this.getCarAdminNotesUseCase.execute(req.params.id);

    res.json({ success: true, data: notes });
  });

  /** POST /api-v1/cars/:id/admin-notes */
  addCarAdminNote = asyncHandler(async (req, res) => {
    const adminNote = await this.addCarAdminNoteUseCase.execute(
      req.params.id,
      { note: req.body.note },
      req.user.user_id
    );

    res.status(201).json({
      success: true,
      data: adminNote,
      message: "Admin note added successfully",
    });
  });

  /** PATCH /api-v1/cars/admin-notes/:noteId */
  updateCarAdminNote = asyncHandler(async (req, res) => {
    const updatedNote = await this.updateCarAdminNoteUseCase.execute(
      req.params.noteId,
      { note: req.body.note }
    );

    res.json({
      success: true,
      data: updatedNote,
      message: "Admin note updated successfully",
    });
  });

  /** DELETE /api-v1/cars/admin-notes/:noteId */
  deleteCarAdminNote = asyncHandler(async (req, res) => {
    const result = await this.deleteCarAdminNoteUseCase.execute(
      req.params.noteId
    );

    res.json(result);
  });

  // ============================================
  // CAR MANAGEMENT (cars:admin)
  // ============================================

  /** POST /api-v1/cars/merge — слияние двух записей с одним номером. */
  mergeCars = asyncHandler(async (req, res) => {
    const { car_id_1: carId1, car_id_2: carId2, merge_options: mergeOptions } =
      req.body;

    const result = await this.mergeCarsUseCase.execute(
      carId1,
      carId2,
      mergeOptions
    );

    res.json(result);
  });

  /** POST /api-v1/cars/:id/assign */
  assignCarToUser = asyncHandler(async (req, res) => {
    const result = await this.assignCarToUserUseCase.execute(
      req.params.id,
      req.body.user_id
    );

    res.json(result);
  });
}
