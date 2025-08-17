import express from "express";
import { pool } from "../config/db.js";

const routerFloorRules = express.Router();

// 1. Получить все правила для дома и подъезда
routerFloorRules.get("/api/floorRules", async (req, res) => {
  const { house, entrance } = req.query;
  if (!house || !entrance) {
    return res.status(400).json({ error: "house and entrance are required" });
  }
  try {
    const { rows } = await pool.query(
      "SELECT * FROM floor_rules WHERE house = $1 AND entrance = $2",
      [house, parseInt(entrance)]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching floor rules:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. Добавить или обновить правило
routerFloorRules.post("/api/floor-rules", async (req, res) => {
  try {
    const { house, entrance, floor, position } = req.body;

    if (!house || !entrance || !floor || !position) {
      return res.status(400).json({
        error: "Все параметры (house, entrance, floor, position) обязательны",
      });
    }

    // Проверяем, что числовые поля действительно являются числами
    if (
      isNaN(parseInt(entrance)) ||
      isNaN(parseInt(floor)) ||
      isNaN(parseInt(position))
    ) {
      return res.status(400).json({
        error: "Поля entrance, floor и position должны быть числами",
      });
    }

    // Проверяем существование записи
    const { rows: existing } = await pool.query(
      `SELECT * FROM floor_rules 
       WHERE house = $1 AND entrance = $2 AND floor = $3`,
      [house, parseInt(entrance), parseInt(floor)]
    );

    let result;
    if (existing.length > 0) {
      // Обновляем существующую запись
      const { rows } = await pool.query(
        `UPDATE floor_rules 
         SET position = $1 
         WHERE house = $2 AND entrance = $3 AND floor = $4 
         RETURNING *`,
        [parseInt(position), house, parseInt(entrance), parseInt(floor)]
      );
      result = rows[0];
    } else {
      // Создаем новую запись
      const { rows } = await pool.query(
        `INSERT INTO floor_rules 
         (house, entrance, floor, position) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [house, parseInt(entrance), parseInt(floor), parseInt(position)]
      );
      result = rows[0];
    }

    res.status(200).json({ data: result });
  } catch (error) {
    console.error("Ошибка при сохранении правила:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default routerFloorRules;
