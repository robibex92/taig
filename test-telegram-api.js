import fetch from "node-fetch";

async function testTelegramAPI() {
  try {
    console.log("🧪 Тестирование API Telegram чатов...");

    const response = await fetch("http://localhost:4000/api-v1/telegram-chats");
    console.log("Status:", response.status);
    console.log("Headers:", Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log("✅ API работает!");
      console.log("Данные:", data);
    } else {
      const error = await response.text();
      console.log("❌ Ошибка API:", error);
    }
  } catch (error) {
    console.error("❌ Ошибка подключения:", error.message);
  }
}

testTelegramAPI();
