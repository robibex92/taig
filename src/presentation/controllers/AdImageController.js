import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import {
  createAdImagesSchema,
  getAdImagesSchema,
  getImagesByIdSchema,
  deleteImagesSchema,
  setMainImageSchema,
  imageIdSchema,
} from "../../core/validation/schemas/adImage.schema.js";

/**
 * AdImage Controller
 * Handles HTTP requests for ad image operations
 */
export class AdImageController {
  constructor(
    createAdImagesUseCase,
    getAdImagesUseCase,
    getImagesByIdUseCase,
    deleteAdImageUseCase,
    deleteMultipleAdImagesUseCase,
    setMainImageUseCase
  ) {
    this.createAdImagesUseCase = createAdImagesUseCase;
    this.getAdImagesUseCase = getAdImagesUseCase;
    this.getImagesByIdUseCase = getImagesByIdUseCase;
    this.deleteAdImageUseCase = deleteAdImageUseCase;
    this.deleteMultipleAdImagesUseCase = deleteMultipleAdImagesUseCase;
    this.setMainImageUseCase = setMainImageUseCase;
  }

  /**
   * POST /api-v1/ad-images
   * Create images for ad or post
   */
  create = asyncHandler(async (req, res) => {
    const { error } = createAdImagesSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { ad_id, post_id, images } = req.body;
    // Используем API_URL из переменных окружения для правильного домена
    const serverUrl = process.env.API_URL
      ? process.env.API_URL.replace("/api-v1", "")
      : req.protocol + "://" + req.get("host");

    const createdImages = await this.createAdImagesUseCase.execute(
      ad_id,
      post_id,
      images,
      serverUrl
    );

    res.status(201).json({
      success: true,
      data: createdImages,
    });
  });

  /**
   * GET /api-v1/ad-images
   * Get images by ad_id or post_id query param
   */
  getByQuery = asyncHandler(async (req, res) => {
    const { error } = getAdImagesSchema.validate(req.query);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { ad_id, post_id } = req.query;
    const images = await this.getAdImagesUseCase.execute(
      ad_id ? parseInt(ad_id) : null,
      post_id ? parseInt(post_id) : null
    );

    res.json({
      success: true,
      images,
    });
  });

  /**
   * GET /api-v1/ad-images/:id
   * Get images by ID (tries as ad_id, then post_id)
   */
  getById = asyncHandler(async (req, res) => {
    const { error } = getImagesByIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const images = await this.getImagesByIdUseCase.execute(
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      images,
    });
  });

  /**
   * DELETE /api-v1/ad-images/:id
   * Delete single image
   */
  deleteOne = asyncHandler(async (req, res) => {
    const { error } = imageIdSchema.validate({
      id: parseInt(req.params.id),
    });

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    await this.deleteAdImageUseCase.execute(parseInt(req.params.id));

    res.json({
      success: true,
      message: "Image deleted",
    });
  });

  /**
   * DELETE /api-v1/ad-images
   * Delete multiple images
   */
  deleteMultiple = asyncHandler(async (req, res) => {
    const { error } = deleteImagesSchema.validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { ids } = req.body;
    const deletedCount = await this.deleteMultipleAdImagesUseCase.execute(ids);

    res.json({
      success: true,
      message: `Deleted ${deletedCount} images`,
      deleted_count: deletedCount,
    });
  });

  /**
   * POST /api-v1/ad-images/set-main/:image_id
   * Set image as main
   */
  setMain = asyncHandler(async (req, res) => {
    const { error: paramError } = imageIdSchema.validate({
      id: parseInt(req.params.image_id),
    });

    if (paramError) {
      throw new ValidationError(paramError.details[0].message);
    }

    const { error: bodyError } = setMainImageSchema.validate({
      image_id: parseInt(req.params.image_id),
      ...req.body,
    });

    if (bodyError) {
      throw new ValidationError(bodyError.details[0].message);
    }

    const { ad_id, post_id } = req.body;
    await this.setMainImageUseCase.execute(
      parseInt(req.params.image_id),
      ad_id,
      post_id
    );

    res.json({
      success: true,
    });
  });

  /**
   * POST /api-v1/ads/delete-image
   * Delete image by URL
   */
  deleteByUrl = asyncHandler(async (req, res) => {
    const { ad_id, image_url } = req.body;

    if (!ad_id || !image_url) {
      throw new ValidationError("ad_id and image_url are required");
    }

    // Get all images for this ad
    const images = await this.getAdImagesUseCase.execute(parseInt(ad_id), null);

    // Find the image with matching URL
    const imageToDelete = images.find((img) => img.image_url === image_url);

    if (!imageToDelete) {
      throw new ValidationError("Image not found");
    }

    // Delete the image by its ID
    await this.deleteAdImageUseCase.execute(imageToDelete.id);

    res.json({
      success: true,
      message: "Image deleted",
    });
  });
}
