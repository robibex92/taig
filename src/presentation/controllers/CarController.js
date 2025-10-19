import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  createCarSchema,
  getUserIdSchema,
  carIdSchema,
} from "../../core/validation/schemas/car.schema.js";

/**
 * Car Controller
 * Handles HTTP requests for car operations
 */
export class CarController {
  constructor(
    getCarsUseCase,
    getUserCarsUseCase,
    createCarUseCase,
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
    carImageUploadService
  ) {
    this.getCarsUseCase = getCarsUseCase;
    this.getUserCarsUseCase = getUserCarsUseCase;
    this.createCarUseCase = createCarUseCase;
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

  /**
   * GET /api-v1/cars
   * Get all active cars
   */
  getAll = asyncHandler(async (req, res) => {
    const cars = await this.getCarsUseCase.execute();

    res.json({
      success: true,
      data: cars,
    });
  });

  /**
   * GET /api-v1/cars/user/:user_id
   * Get cars by user ID
   */
  getUserCars = asyncHandler(async (req, res) => {
    const { error } = getUserIdSchema.validate({
      user_id: parseInt(req.params.user_id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const cars = await this.getUserCarsUseCase.execute(
      parseInt(req.params.user_id)
    );

    res.json({
      success: true,
      data: cars,
    });
  });

  /**
   * POST /api-v1/cars
   * Create new car
   */
  create = asyncHandler(async (req, res) => {
    const { error } = createCarSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const car = await this.createCarUseCase.execute(req.body);

    res.status(201).json({
      success: true,
      data: car,
    });
  });

  /**
   * DELETE /api-v1/cars/:id
   * Soft delete car
   */
  delete = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    await this.deleteCarUseCase.execute(parseInt(req.params.id));

    res.status(204).send();
  });

  // ============================================
  // CAR IMAGES (Gallery functionality)
  // ============================================

  /**
   * GET /api-v1/cars/:id/images
   * Get all images for a specific car
   */
  getCarImages = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const isAdmin = req.user?.role === true;
    const images = await this.getCarImagesUseCase.execute(
      parseInt(req.params.id),
      isAdmin
    );

    res.json({
      success: true,
      data: images,
    });
  });

  /**
   * POST /api-v1/cars/:id/images
   * Add new image to car gallery (supports both file upload and URL)
   */
  addCarImage = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { comment } = req.body;
    let image_url;

    // Check if file was uploaded
    if (req.file) {
      // File upload
      // Используем API_URL из переменных окружения для правильного домена
      const serverUrl = process.env.API_URL
        ? process.env.API_URL.replace("/api-v1", "")
        : `${req.protocol}://${req.get("host")}`;
      image_url = this.carImageUploadService.getFileUrl(
        req.file.filename,
        serverUrl
      );

      // Process and optimize the image
      await this.carImageUploadService.processImage(req.file.path);
    } else {
      // URL provided
      image_url = req.body.image_url;
      if (!image_url) {
        throw new ValidationError("Either image file or image URL is required");
      }
    }

    const image = await this.addCarImageUseCase.execute(
      parseInt(req.params.id),
      { image_url, comment },
      req.user?.user_id
    );

    res.status(201).json({
      success: true,
      data: image,
      message: "Image added successfully",
    });
  });

  /**
   * PATCH /api-v1/cars/images/:imageId
   * Update car image (mainly for comments)
   */
  updateCarImage = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.imageId),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { comment } = req.body;
    const image = await this.updateCarImageUseCase.execute(
      parseInt(req.params.imageId),
      { comment }
    );

    res.json({
      success: true,
      data: image,
      message: "Image updated successfully",
    });
  });

  /**
   * DELETE /api-v1/cars/images/:imageId
   * Delete car image
   */
  deleteCarImage = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.imageId),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const result = await this.deleteCarImageUseCase.execute(
      parseInt(req.params.imageId)
    );

    res.json(result);
  });

  // ============================================
  // CAR ADMIN NOTES (Admin only)
  // ============================================

  /**
   * GET /api-v1/cars/:id/admin-notes
   * Get admin notes for a specific car (admin only)
   */
  getCarAdminNotes = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const notes = await this.getCarAdminNotesUseCase.execute(
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      data: notes,
    });
  });

  /**
   * POST /api-v1/cars/:id/admin-notes
   * Add admin note to car (admin only)
   */
  addCarAdminNote = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { note } = req.body;
    if (!note || note.trim().length === 0) {
      throw new ValidationError("Note content is required");
    }

    const adminNote = await this.addCarAdminNoteUseCase.execute(
      parseInt(req.params.id),
      { note },
      req.user.user_id
    );

    res.status(201).json({
      success: true,
      data: adminNote,
      message: "Admin note added successfully",
    });
  });

  /**
   * PATCH /api-v1/cars/admin-notes/:noteId
   * Update admin note (admin only)
   */
  updateCarAdminNote = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.noteId),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { note } = req.body;
    if (!note || note.trim().length === 0) {
      throw new ValidationError("Note content is required");
    }

    const updatedNote = await this.updateCarAdminNoteUseCase.execute(
      parseInt(req.params.noteId),
      { note }
    );

    res.json({
      success: true,
      data: updatedNote,
      message: "Admin note updated successfully",
    });
  });

  /**
   * DELETE /api-v1/cars/admin-notes/:noteId
   * Delete admin note (admin only)
   */
  deleteCarAdminNote = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.noteId),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const result = await this.deleteCarAdminNoteUseCase.execute(
      parseInt(req.params.noteId)
    );

    res.json(result);
  });

  // ============================================
  // CAR MANAGEMENT (Admin only)
  // ============================================

  /**
   * POST /api-v1/cars/merge
   * Merge two cars with the same number (admin only)
   */
  mergeCars = asyncHandler(async (req, res) => {
    const { car_id_1, car_id_2, merge_options } = req.body;

    if (!car_id_1 || !car_id_2) {
      throw new ValidationError("Both car IDs are required");
    }

    const result = await this.mergeCarsUseCase.execute(
      car_id_1,
      car_id_2,
      merge_options
    );

    res.json(result);
  });

  /**
   * POST /api-v1/cars/:id/assign
   * Assign car to user (admin only)
   */
  assignCarToUser = asyncHandler(async (req, res) => {
    const { error } = carIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { user_id } = req.body;
    if (!user_id) {
      throw new ValidationError("User ID is required");
    }

    const result = await this.assignCarToUserUseCase.execute(
      parseInt(req.params.id),
      user_id
    );

    res.json(result);
  });
}
