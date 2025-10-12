import { prisma } from "../database/prisma.js";
import { IAdImageRepository } from "../../domain/repositories/IAdImageRepository.js";
import { AdImage } from "../../domain/entities/AdImage.entity.js";

/**
 * AdImage Repository Implementation with Prisma
 * Handles database operations for ad images
 */
export class AdImageRepository extends IAdImageRepository {
  /**
   * Find all images by ad ID
   */
  async findByAdId(adId) {
    const images = await prisma.adImage.findMany({
      where: {
        ad_id: parseInt(adId),
      },
      orderBy: [{ is_main: "desc" }, { created_at: "asc" }],
    });

    return images.map((img) => AdImage.fromDatabase(img));
  }

  /**
   * Find all images by post ID
   */
  async findByPostId(postId) {
    const images = await prisma.adImage.findMany({
      where: {
        post_id: parseInt(postId),
      },
      orderBy: [{ is_main: "desc" }, { created_at: "asc" }],
    });

    return images.map((img) => AdImage.fromDatabase(img));
  }

  /**
   * Find image by ID
   */
  async findById(id) {
    const image = await prisma.adImage.findUnique({
      where: { id: parseInt(id) },
    });

    return image ? AdImage.fromDatabase(image) : null;
  }

  /**
   * Create multiple images
   */
  async createMultiple(adId, postId, images, serverUrl) {
    const imagesToCreate = images.map((img) => ({
      ad_id: adId ? parseInt(adId) : null,
      post_id: postId ? parseInt(postId) : null,
      image_url: img.image_url.startsWith("http")
        ? img.image_url
        : `${serverUrl}${img.image_url}`,
      is_main: img.is_main || false,
      created_at: new Date(),
    }));

    const createdImages = await prisma.adImage.createMany({
      data: imagesToCreate,
    });

    // Fetch created images to return with IDs
    let where = {};
    if (adId) where.ad_id = parseInt(adId);
    if (postId) where.post_id = parseInt(postId);

    const result = await prisma.adImage.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: images.length,
    });

    return result.map((img) => AdImage.fromDatabase(img));
  }

  /**
   * Delete image by ID
   */
  async deleteById(id) {
    await prisma.adImage.delete({
      where: { id: parseInt(id) },
    });

    return true;
  }

  /**
   * Delete multiple images
   */
  async deleteMultiple(ids) {
    const result = await prisma.adImage.deleteMany({
      where: {
        id: {
          in: ids.map((id) => parseInt(id)),
        },
      },
    });

    return result.count;
  }

  /**
   * Set image as main
   */
  async setMainImage(imageId, adId, postId) {
    await prisma.$transaction(async (tx) => {
      // Unset all main images for this ad/post
      const where = {};
      if (adId) where.ad_id = parseInt(adId);
      if (postId) where.post_id = parseInt(postId);

      await tx.adImage.updateMany({
        where,
        data: { is_main: false },
      });

      // Set new main image
      await tx.adImage.update({
        where: { id: parseInt(imageId) },
        data: { is_main: true },
      });
    });

    return true;
  }
}
