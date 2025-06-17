import { verifyToken } from "../services/token-service.js";

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateJWT = async (req, res, next) => {
  try {
    console.log("authenticateJWT middleware called");
    console.log("Headers:", req.headers);

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("No Authorization header found");
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      console.log("No token in Authorization header");
      return res.status(401).json({ error: "Invalid token format" });
    }

    console.log("Verifying token:", token);
    const decoded = verifyToken(token);
    console.log("Token decoded:", decoded);

    if (!decoded || !decoded.id) {
      console.log("Invalid token or missing user id in decoded token");
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = { user_id: decoded.id };
    console.log("User authenticated:", req.user);
    next();
  } catch (error) {
    console.error("Error in authenticateJWT:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

// Новый middleware для условной аутентификации
export const authenticateConditional = async (req, res, next) => {
  try {
    console.log("authenticateConditional middleware called");
    console.log("Body:", req.body);

    // Проверяем, является ли это запросом обратной связи
    const isFeedback = req.body.contextType === "feedback";

    // Проверяем наличие токена авторизации
    const authHeader = req.headers.authorization;

    if (isFeedback && !authHeader) {
      console.log(
        "Feedback request without auth token - setting user_id to null"
      );
      // Для обратной связи без токена устанавливаем user_id как null
      req.user = { user_id: null };
      return next();
    }

    if (isFeedback && authHeader) {
      console.log("Feedback request with auth token - authenticating user");
      // Для обратной связи с токеном проверяем токен
      const token = authHeader.split(" ")[1];
      if (!token) {
        console.log("No token in Authorization header");
        return res.status(401).json({ error: "Invalid token format" });
      }

      console.log("Verifying token for feedback:", token);
      const decoded = verifyToken(token);
      console.log("Token decoded for feedback:", decoded);

      if (!decoded || !decoded.id) {
        console.log(
          "Invalid token or missing user id in decoded token for feedback"
        );
        return res.status(401).json({ error: "Invalid token" });
      }

      req.user = { user_id: decoded.id };
      console.log("User authenticated for feedback:", req.user);
      return next();
    }

    // Для всех остальных типов запросов требуем аутентификацию
    if (!authHeader) {
      console.log("No Authorization header found for non-feedback request");
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      console.log("No token in Authorization header");
      return res.status(401).json({ error: "Invalid token format" });
    }

    console.log("Verifying token:", token);
    const decoded = verifyToken(token);
    console.log("Token decoded:", decoded);

    if (!decoded || !decoded.id) {
      console.log("Invalid token or missing user id in decoded token");
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = { user_id: decoded.id };
    console.log("User authenticated:", req.user);
    next();
  } catch (error) {
    console.error("Error in authenticateConditional:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
};
