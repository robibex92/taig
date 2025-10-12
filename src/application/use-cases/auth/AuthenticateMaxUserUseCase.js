const {
  ValidationError,
  AuthenticationError,
} = require("../../../core/errors/AppError");

/**
 * Authenticate MAX User Use Case
 * Handles MAX Platform authentication
 */
class AuthenticateMaxUserUseCase {
  constructor({
    userRepository,
    tokenService,
    refreshTokenRepository,
    maxService,
  }) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;
    this.maxService = maxService;
  }

  async execute({
    max_id,
    max_first_name,
    max_last_name,
    max_photo_url,
    max_platform,
    hash,
    auth_key,
    auth_date,
    deviceInfo = {},
  }) {
    // 1. Validate MAX signature
    if (
      !this.maxService.verifySignature(
        { max_id, auth_key, auth_date, hash },
        process.env.MAX_BOT_SECRET
      )
    ) {
      throw new AuthenticationError("Invalid MAX signature");
    }

    // 2. Check if user exists by max_id
    let user = await this.userRepository.findByMaxId(max_id);

    if (!user) {
      // 3. Create new user with MAX data
      user = await this.userRepository.create({
        max_id,
        max_first_name,
        max_last_name,
        max_photo_url,
        max_platform,
        first_name: max_first_name,
        last_name: max_last_name,
        photo_url: max_photo_url,
        primary_platform: "max",
        platforms_linked: false,
        status: "user",
      });
    } else {
      // 4. Update MAX user data
      await this.userRepository.update(user.id, {
        max_first_name,
        max_last_name,
        max_photo_url,
        max_platform,
      });
    }

    // 5. Generate JWT tokens
    const { accessToken, refreshToken, jti } =
      await this.tokenService.generateTokens({
        id: user.id,
        status: user.status,
        platform: "max",
      });

    // 6. Store refresh token with device info
    await this.refreshTokenRepository.create({
      user_id: user.id,
      token: refreshToken,
      jti,
      platform: "max",
      device: deviceInfo.device || null,
      ip: deviceInfo.ip || null,
      user_agent: deviceInfo.userAgent || null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return {
      user: {
        id: user.id,
        max_id: user.max_id,
        first_name: user.first_name,
        last_name: user.last_name,
        photo_url: user.photo_url,
        status: user.status,
        primary_platform: user.primary_platform,
        platforms_linked: user.platforms_linked,
      },
      accessToken,
      refreshToken,
    };
  }
}

module.exports = AuthenticateMaxUserUseCase;
