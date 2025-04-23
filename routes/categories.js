import express from "express";
import { pool } from "../config/db.js";

const routerCategories = express.Router();

// 1. Получить все категории
routerCategories.get("/api/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM categories ORDER BY id ASC"
    );
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// 2. Получить конкретную категорию по ID
routerCategories.get("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, существует ли категория с указанным ID
    const { rows } = await pool.query(
      "SELECT * FROM categories WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Возвращаем найденную категорию
    res.json({ data: rows[0] });
  } catch (error) {
    console.error("Error fetching category by ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Получить все подкатегории для выбранной категории
routerCategories.get(
  "/api/categories/:category_id/subcategories",
  async (req, res) => {
    try {
      const { category_id } = req.params;
      // Сначала проверяем существование категории
      const { rows: categoryCheck } = await pool.query(
        "SELECT id FROM categories WHERE id = $1",
        [category_id]
      );
      if (categoryCheck.length === 0) {
        return res.status(404).json({ error: "Category not found" });
      }
      // Получаем подкатегории
      const { rows } = await pool.query(
        "SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name ASC",
        [category_id]
      );
      res.json({ subcategories: rows });
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// 4. Получить все подкатегории сразу (для фронта)
routerCategories.get("/api/subcategories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM subcategories ORDER BY category_id, name ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching all subcategories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// 4. Получить конкретную подкатегорию
routerCategories.get(
  "/api/categories/:category_id/subcategories/:subcategory_id",
  async (req, res) => {
    try {
      const { category_id, subcategory_id } = req.params;

      // Проверяем существование категории
      const { rows: categoryCheck } = await pool.query(
        "SELECT id FROM categories WHERE id = $1",
        [category_id]
      );

      if (categoryCheck.length === 0) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Проверяем существование подкатегории
      const { rows: subcategoryCheck } = await pool.query(
        "SELECT * FROM subcategories WHERE id = $1 AND category_id = $2",
        [subcategory_id, category_id]
      );

      if (subcategoryCheck.length === 0) {
        return res.status(404).json({ error: "Subcategory not found" });
      }

      // Возвращаем найденную подкатегорию
      res.json({
        category: categoryCheck[0],
        subcategory: subcategoryCheck[0],
      });
    } catch (error) {
      console.error("Error fetching subcategory:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default routerCategories;
