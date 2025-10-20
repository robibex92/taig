import { prisma } from "../database/prisma.js";
import { ICategoryRepository } from "../../domain/repositories/ICategoryRepository.js";
import { Category } from "../../domain/entities/Category.entity.js";
import { Subcategory } from "../../domain/entities/Subcategory.entity.js";

/**
 * Category Repository Implementation with Prisma
 * Handles database operations for categories and subcategories
 */
export class CategoryRepository extends ICategoryRepository {
  /**
   * Get all categories
   */
  async findAll() {
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
    });

    return categories.map((cat) => Category.fromDatabase(cat));
  }

  /**
   * Find category by ID
   */
  async findById(id) {
    const category = await prisma.category.findUnique({
      where: { id: Number(id) },
    });

    return category ? Category.fromDatabase(category) : null;
  }

  /**
   * Get all subcategories for a category
   */
  async findSubcategoriesByCategoryId(categoryId) {
    const subcategories = await prisma.subcategory.findMany({
      where: {
        category_id: Number(categoryId),
      },
      orderBy: { name: "asc" },
    });

    return subcategories.map((sub) => Subcategory.fromDatabase(sub));
  }

  /**
   * Get all subcategories
   */
  async findAllSubcategories() {
    const subcategories = await prisma.subcategory.findMany({
      orderBy: [{ category_id: "asc" }, { name: "asc" }],
    });

    return subcategories.map((sub) => Subcategory.fromDatabase(sub));
  }

  /**
   * Find subcategory by ID and category ID
   */
  async findSubcategoryById(subcategoryId, categoryId) {
    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: Number(categoryId) },
    });

    if (!category) {
      return null;
    }

    // Check if subcategory exists
    const subcategory = await prisma.subcategory.findFirst({
      where: {
        id: Number(subcategoryId),
        category_id: Number(categoryId),
      },
    });

    if (!subcategory) {
      return null;
    }

    return {
      category: Category.fromDatabase(category),
      subcategory: Subcategory.fromDatabase(subcategory),
    };
  }

  /**
   * Get categories with ad counts
   */
  async getCategoriesWithAdCounts() {
    const categoriesWithCounts = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            ads: {
              where: {
                status: "active",
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    return categoriesWithCounts.map((cat) => ({
      id: cat.id,
      name: cat.name,
      image: cat.image,
      adCount: cat._count.ads,
    }));
  }

  /**
   * Get subcategories with ad counts for a category
   */
  async getSubcategoriesWithAdCounts(categoryId) {
    const subcategoriesWithCounts = await prisma.subcategory.findMany({
      where: {
        category_id: Number(categoryId),
      },
      include: {
        _count: {
          select: {
            ads: {
              where: {
                status: "active",
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return subcategoriesWithCounts.map((sub) => ({
      id: sub.id,
      name: sub.name,
      category_id: sub.category_id,
      adCount: sub._count.ads,
    }));
  }
}
