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
    // Получаем все категории
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
    });

    // Для каждой категории подсчитываем активные объявления
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const adCount = await prisma.ad.count({
          where: {
            category: Number(category.id),
            status: "active",
          },
        });

        return {
          id: category.id,
          name: category.name,
          image: category.image,
          adCount: adCount,
        };
      })
    );

    return categoriesWithCounts;
  }

  /**
   * Get subcategories with ad counts for a category
   */
  async getSubcategoriesWithAdCounts(categoryId) {
    // Получаем все подкатегории для данной категории
    const subcategories = await prisma.subcategory.findMany({
      where: {
        category_id: Number(categoryId),
      },
      orderBy: { name: "asc" },
    });

    // Для каждой подкатегории подсчитываем активные объявления
    const subcategoriesWithCounts = await Promise.all(
      subcategories.map(async (subcategory) => {
        const adCount = await prisma.ad.count({
          where: {
            subcategory: Number(subcategory.id),
            status: "active",
          },
        });

        return {
          id: subcategory.id,
          name: subcategory.name,
          category_id: subcategory.category_id,
          adCount: adCount,
        };
      })
    );

    return subcategoriesWithCounts;
  }
}
