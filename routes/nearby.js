import express from "express";
import { pool } from "../config/db.js";

const routerNearby = express.Router(); // Уникальное имя роутера

// 1. Получить все уникальные дома
routerNearby.get("/api/nearby/houses", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT DISTINCT house FROM houses WHERE status = true ORDER BY house ASC"
    );
    const houses = rows.map((row) => row.house);
    res.json({ data: houses });
  } catch (error) {
    console.error("Error fetching unique houses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. Получить все уникальные подъезды для конкретного дома (через query параметр house)
routerNearby.get("/api/nearby/entrances", async (req, res) => {
  try {
    const { house } = req.query;
    if (!house) {
      return res.status(400).json({ error: "House parameter is required" });
    }
    const { rows } = await pool.query(
      "SELECT DISTINCT entrance FROM houses WHERE house = $1 AND status = true ORDER BY entrance ASC",
      [house]
    );
    const entrances = rows.map((row) => row.entrance);
    res.json({ data: entrances });
  } catch (error) {
    console.error("Error fetching unique entrances:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Получить по фильтру house, entrance, position с сортировкой по number
routerNearby.get("/api/nearby", async (req, res) => {
  try {
    const { house, entrance, position } = req.query;
    let query = "SELECT * FROM houses WHERE 1=1";
    const params = [];

    if (house) {
      params.push(house);
      query += ` AND house = $${params.length}`;
    }
    if (entrance) {
      params.push(entrance);
      query += ` AND entrance = $${params.length}`;
    }
    // Если явно не передан position, по умолчанию только position = 1
    if (typeof position !== "undefined") {
      params.push(position);
      query += ` AND position = $${params.length}`;
    } else {
      query += ` AND position = 1`;
    }

    query += " ORDER BY number ASC";

    const { rows } = await pool.query(query, params);
    // Исключаем ненужные поля
    const filtered = rows.map(
      ({ house, entrance, status, created_at, info, ...rest }) => ({
        ...rest,
        hasInfo: !!(info && info.trim()),
      })
    );
    res.json({ data: filtered });
  } catch (error) {
    console.error("Error fetching houses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 4. Получить все строки по id_telegram
routerNearby.get("/api/nearby/user/:id_telegram", async (req, res) => {
  try {
    const { id_telegram } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM houses WHERE id_telegram = $1 ORDER BY house, entrance, position, number",
      [id_telegram]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching user houses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. Создать/обновить запись с id_telegram
routerNearby.post("/api/nearby", async (req, res) => {
  try {
    const { house, entrance, number, id_telegram } = req.body;

    // Находим запись с position=1 только по house и number (entrance не учитываем)
    const { rows: existingRows } = await pool.query(
      `SELECT * FROM houses WHERE house = $1 AND number = $2 AND position = 1 LIMIT 1`,
      [house, number]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Base position not found" });
    }

    const baseRecord = existingRows[0];

    if (!baseRecord.id_telegram) {
      // Обновляем position=1 если свободен
      await pool.query(
        `UPDATE houses SET id_telegram = $1 
         WHERE id = $2`,
        [id_telegram, baseRecord.id]
      );
      return res.json({
        message: "Updated existing position 1",
        data: { ...baseRecord, id_telegram },
      });
    } else {
      // Проверяем, есть ли уже запись с position=1 для этой квартиры
      const { rows: alreadyHasPos1 } = await pool.query(
        `SELECT * FROM houses WHERE house = $1 AND number = $2 AND position = 1`,
        [house, number]
      );
      if (alreadyHasPos1.length > 1) {
        return res.status(400).json({
          error:
            "В базе уже есть несколько записей с position=1 для этой квартиры! Обратитесь к администратору.",
        });
      }
      // Создаём новую запись только если position > 1
      const { rows: maxPosition } = await pool.query(
        `SELECT MAX(position) as max_position FROM houses WHERE house = $1 AND number = $2`,
        [house, number]
      );
      const newPosition = (maxPosition[0].max_position || 1) + 1;
      // entrance и floor берём из baseRecord (position=1)
      const { rows: newRow } = await pool.query(
        `INSERT INTO houses 
         (house, entrance, floor, number, position, facade_color, info, status, id_telegram, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          house,
          baseRecord.entrance,
          baseRecord.floor,
          number,
          newPosition,
          baseRecord.facade_color,
          "",
          true,
          id_telegram,
        ]
      );
      return res.status(201).json({
        message: `Created new position ${newPosition}`,
        data: newRow[0],
      });
    }
  } catch (error) {
    console.error("Error updating house:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Новый роут: получить info по id квартиры
routerNearby.get("/api/nearby/:id/info", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT info FROM houses WHERE id = $1", [
      id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ info: rows[0].info });
  } catch (error) {
    console.error("Error fetching apartment info:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Удаление id_telegram (отвязка квартиры от пользователя) ---
// POST /api/nearby/unlink
// body: { id, id_telegram }
routerNearby.post("/api/nearby/unlink", async (req, res) => {
  console.log("UNLINK BODY:", req.body);
  try {
    const { id, id_telegram } = req.body;
    // Найти строку по id
    const { rows } = await pool.query("SELECT * FROM houses WHERE id = $1", [
      id,
    ]);
    if (!rows.length) {
      console.log("UNLINK: строка не найдена по id", id);
      return res.status(404).json({ error: "Not found" });
    }
    const row = rows[0];

    if (row.position === 1) {
      const { rows: allRows } = await pool.query(
        "SELECT * FROM houses WHERE house = $1 AND entrance = $2 AND number = $3 ORDER BY position ASC",
        [row.house, row.entrance, row.number]
      );
      console.log(
        "UNLINK: найдено строк по адресу:",
        allRows.length,
        allRows.map((r) => r.id)
      );
      if (allRows.length === 1) {
        await pool.query("UPDATE houses SET id_telegram = NULL WHERE id = $1", [
          id,
        ]);
        console.log("UNLINK: только одна строка, обнуляем id_telegram");
        return res.json({ message: "id_telegram unlinked (single)" });
      } else if (allRows.length >= 2) {
        const next = allRows[1];
        await pool.query("UPDATE houses SET id_telegram = $1 WHERE id = $2", [
          next.id_telegram,
          id,
        ]);
        console.log(
          `UNLINK: переносим id_telegram (${next.id_telegram}) из строки ${next.id} в строку ${id}`
        );
        await pool.query("DELETE FROM houses WHERE id = $1", [next.id]);
        console.log("UNLINK: удалена строка", next.id);
        return res.json({
          message: "position 1 replaced with position 2, position 2 deleted",
        });
      }
      // Если вдруг не попали ни в одно условие выше
      console.log("UNLINK: не попали ни в одно условие для position=1");
      return res.json({ message: "no action for position=1" });
    } else {
      await pool.query("DELETE FROM houses WHERE id = $1", [id]);
      console.log("UNLINK: удалена строка с позицией > 1", id);
      return res.json({ message: "position > 1 record deleted" });
    }
  } catch (error) {
    console.error("Error unlinking id_telegram:", error, error.stack);
    res
      .status(500)
      .json({ error: "Error unlinking id_telegram", details: error.message });
  }
});

export default routerNearby; // Экспорт под уникальным именем
