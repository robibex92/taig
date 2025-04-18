import express from "express";
import { pool } from "../config/db.js";

const routerPosts = express.Router();

// Получение постов только по статусу и сортировка по дате создания
routerPosts.get("/api/posts", async (req, res) => {
  try {
    const { status = "active" } = req.query; // По умолчанию 'active'

    const { rows } = await pool.query(
      "SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC",
      [status]
    );

    res.json({ data: rows });
  } catch (error) {
    console.error("Ошибка при загрузке постов:", error);
    res.status(500).json({ error: "Не удалось загрузить посты" });
  }
});

// Создание поста
routerPosts.post("/api/posts", async (req, res) => {
  try {
    console.log("POST /api/posts body:", req.body); // Логируем тело запроса
    const { title, content, image_url, status, source, marker } = req.body;

    await pool.query(
      `INSERT INTO posts 
       (title, content, image_url, status, source, marker, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)`, // updated_at явно устанавливаем в NULL
      [title, content, image_url, status, source, marker]
    );

    console.log(`[${new Date().toISOString()}] Новость создана: "${title}"`);
    res.status(201).json({ message: "Created" });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Ошибка создания новости:`,
      error
    );
    res.sendStatus(500);
  }
});

// Редактирование поста
routerPosts.patch("/api/posts/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const { title, content, image_url, source } = req.body;

    const { rows } = await pool.query(
      `UPDATE posts
         SET title = $1,
             content = $2,
             image_url = $3,
             source = $4,
             updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [title, content, image_url, source, postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({ data: rows[0] });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка редактирования поста #${req.params.id}:`, error);
    res.sendStatus(500);
  }
});

// Закрытие поста (изменение статуса на deleted)
routerPosts.patch("/api/posts/:id/close", async (req, res) => {
  try {
    const postId = req.params.id;

    // Обновляем статус и updated_at
    await pool.query(
      `UPDATE posts 
       SET status = 'deleted', 
           updated_at = NOW() 
       WHERE id = $1`,
      [postId]
    );

    console.log(
      `[${new Date().toISOString()}] Пост #${postId} закрыт (status=deleted)`
    );
    res.sendStatus(200); // OK
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Ошибка закрытия поста #${req.params.id}:`,
      error
    );
    res.sendStatus(500); // Internal Server Error
  }
});

export default routerPosts;
