import { TokenService } from "../../../application/services/TokenService.js";

// Mock environment variables
process.env.JWT_SECRET = "test-secret-key-minimum-32-characters";
process.env.JWT_ACCESS_EXPIRATION = "15m";
process.env.JWT_REFRESH_EXPIRATION = "30d";

describe("TokenService", () => {
  let tokenService;
  const mockUser = { user_id: 123 };

  beforeEach(() => {
    tokenService = new TokenService();
  });

  describe("generateTokens", () => {
    it("should generate access and refresh tokens", () => {
      const tokens = tokenService.generateTokens(mockUser);

      expect(tokens).toHaveProperty("accessToken");
      expect(tokens).toHaveProperty("refreshToken");
      expect(typeof tokens.accessToken).toBe("string");
      expect(typeof tokens.refreshToken).toBe("string");
    });

    it("should generate different tokens each time", () => {
      const tokens1 = tokenService.generateTokens(mockUser);
      const tokens2 = tokenService.generateTokens(mockUser);

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe("verifyToken", () => {
    it("should verify a valid token", () => {
      const { accessToken } = tokenService.generateTokens(mockUser);
      const decoded = tokenService.verifyToken(accessToken);

      expect(decoded).toHaveProperty("id", 123);
    });

    it("should throw for an invalid token", () => {
      expect(() => {
        tokenService.verifyToken("invalid-token");
      }).toThrow();
    });

    it("should throw for a tampered token", () => {
      const { accessToken } = tokenService.generateTokens(mockUser);
      const tamperedToken = accessToken + "tampered";

      expect(() => {
        tokenService.verifyToken(tamperedToken);
      }).toThrow();
    });
  });

  describe("decodeToken", () => {
    it("should decode a token without verification", () => {
      const { accessToken } = tokenService.generateTokens(mockUser);
      const decoded = tokenService.decodeToken(accessToken);

      expect(decoded).toHaveProperty("id", 123);
      expect(decoded).toHaveProperty("iat");
      expect(decoded).toHaveProperty("exp");
    });

    it("should return null for an invalid token", () => {
      const decoded = tokenService.decodeToken("invalid-token");
      expect(decoded).toBeNull();
    });
  });
});
