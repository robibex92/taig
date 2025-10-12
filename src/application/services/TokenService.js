import jwt from "jsonwebtoken";
import { AuthenticationError } from "../../core/errors/AppError.js";

/**
 * Service for handling JWT tokens
 */
export class TokenService {
  constructor() {
    this.accessTokenExpiration = process.env.JWT_ACCESS_EXPIRATION || "15m";
    this.refreshTokenExpiration = process.env.JWT_REFRESH_EXPIRATION || "30d";
    this.secret = process.env.JWT_SECRET;

    if (!this.secret) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }
  }

  /**
   * Generate access and refresh tokens
   */
  generateTokens(user) {
    const payload = { id: user.user_id };

    const accessToken = jwt.sign(payload, this.secret, {
      expiresIn: this.accessTokenExpiration,
    });

    const refreshToken = jwt.sign(payload, this.secret, {
      expiresIn: this.refreshTokenExpiration,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify a token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new AuthenticationError("Token expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new AuthenticationError("Invalid token");
      }
      throw new AuthenticationError("Token verification failed");
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token) {
    return jwt.decode(token);
  }
}
