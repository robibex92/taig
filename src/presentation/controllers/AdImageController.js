import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { ValidationError } from "../../core/errors/AppError.js";
import { buildServerUrl } from "../../core/utils/requestUrl.js";
import {
  createAdImagesSchema,
  getAdImagesSchema,
  getImagesByIdSchema,
  deleteImagesSchema,
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
    const serverUrl = buildServerUrl(req);

    const createdImages = await this.createAdImagesUseCase.execute(
      ad_id,
      post_id,
      images,
      serverUrl,
      req.user
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

    await this.deleteAdImageUseCase.execute(parseInt(req.params.id), req.user);

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
    const deletedCount = await this.deleteMultipleAdImagesUseCase.execute(ids, req.user);

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

    // `ad_id`/`post_id` из тела больше не участвуют: хозяин снимка берётся из
    // строки `ad_images`, иначе им можно было бы прикрыть чужое объявление.
    await this.setMainImageUseCase.execute(parseInt(req.params.image_id), req.user);

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

    await this.deleteAdImageUseCase.execute(imageToDelete.id, req.user);

    res.json({
      success: true,
      message: "Image deleted",
    });
  });
}
