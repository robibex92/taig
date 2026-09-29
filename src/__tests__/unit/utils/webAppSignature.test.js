import crypto from "crypto";
import { verifyWebAppInitData } from "../../../core/utils/webAppSignature.js";

/**
 * Round-trip: подписываем `initData` сами и проверяем нашим же верификатором.
 * Тест доказывает корректность разбора и сборки data_check_string, но НЕ
 * доказывает, какой из двух вариантов secret_key выбирает Telegram — это
 * определяет лог `key_variant` на первом реальном входе (`H9.2`).
 */
const BOT_TOKEN = "123456:AAFakeTokenForTests_only-0";

const buildInitData = ({ user, authDate, secretKey }) => {
  const fields = {
    auth_date: String(authDate),
    query_id: "AAH87YLf",
    user: JSON.stringify(user),
  };

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");

  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const pairs = Object.entries(fields).map(
    ([key, value]) => `${key}=${encodeURIComponent(value)}`
  );

  pairs.push(`hash=${hash}`);

  return pairs.join("&");
};

const variantA = (botToken) =>
  crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

const variantB = (botToken) =>
  crypto
    .createHmac("sha256", crypto.createHash("sha256").update(botToken).digest())
    .update("WebAppData")
    .digest();

describe("verifyWebAppInitData", () => {
  const user = { id: 777, first_name: "Anton", username: "rabota" };
  const now = Math.floor(Date.now() / 1000);

  it("принимает подпись варианта A и называет её", () => {
    const initData = buildInitData({ user, authDate: now, secretKey: variantA(BOT_TOKEN) });
    const result = verifyWebAppInitData(initData, BOT_TOKEN);

    expect(result.valid).toBe(true);
    expect(result.keyVariant).toBe("hmac-over-token");
    expect(result.user).toEqual(user);
    expect(result.authDate).toBe(now);
  });

  it("принимает подпись варианта B и называет её", () => {
    const initData = buildInitData({ user, authDate: now, secretKey: variantB(BOT_TOKEN) });
    const result = verifyWebAppInitData(initData, BOT_TOKEN);

    expect(result.valid).toBe(true);
    expect(result.keyVariant).toBe("hmac-over-sha256-token");
  });

  it("отвергает подпись от другого токена", () => {
    const initData = buildInitData({ user, authDate: now, secretKey: variantA("999:OtherToken") });
    const result = verifyWebAppInitData(initData, BOT_TOKEN);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("hash_mismatch");
  });

  it("отвергает подделанный user при сохранённом hash", () => {
    const initData = buildInitData({ user, authDate: now, secretKey: variantA(BOT_TOKEN) });
    const tampered = initData.replace(encodeURIComponent(JSON.stringify(user)), encodeURIComponent(JSON.stringify({ id: 1, first_name: "Chujko" })));
    const result = verifyWebAppInitData(tampered, BOT_TOKEN);

    expect(result.valid).toBe(false);
  });

  it("не падает на мусоре", () => {
    expect(verifyWebAppInitData("", BOT_TOKEN).reason).toBe("empty");
    expect(verifyWebAppInitData("auth_date", BOT_TOKEN).reason).toBe("malformed_pair");
    expect(verifyWebAppInitData("a=1&a=2", BOT_TOKEN).reason).toBe("duplicate_key");
    expect(verifyWebAppInitData("a=1", BOT_TOKEN).reason).toBe("missing_hash");
    expect(verifyWebAppInitData("a=1&hash=zz", BOT_TOKEN).reason).toBe("invalid_hash_format");
    expect(verifyWebAppInitData("auth_date=1&hash=" + "a".repeat(64), "").reason).toBe(
      "no_bot_token"
    );
  });
});
