import fetch from "node-fetch";
import crypto from 'crypto';

// Симуляция данных от Telegram для авторизации
const mockTelegramData = {
  id: 123456789,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  photo_url: 'https://example.com/photo.jpg',
  auth_date: Math.floor(Date.now() / 1000),
  hash: ''
};

// Функция для генерации правильного хеша
function generateTelegramHash(data, botToken) {
  const secret = crypto
    .createHash("sha256")
    .update(botToken)
    .digest();

  const checkString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(checkString)
    .digest("hex");

  return hmac;
}

async function testTelegramAPI() {
  try {
    console.log("🧪 Тестирование полного цикла API Telegram...\n");

    // 1. Тест авторизации через Telegram
    console.log("1️⃣ Тестирование авторизации через Telegram...");
    
    // Генерируем правильный хеш (используем тестовый токен)
    const testBotToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    const { hash, ...dataForHash } = mockTelegramData;
    mockTelegramData.hash = generateTelegramHash(dataForHash, testBotToken);

    const authResponse = await fetch("http://localhost:4000/api/auth/telegram", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockTelegramData),
    });

    console.log("Auth Status:", authResponse.status);
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log("✅ Авторизация успешна!");
      
      if (authData.success && authData.data?.accessToken) {
        const accessToken = authData.data.accessToken;
        
        // 2. Тест API Telegram чатов с токеном
        console.log("\n2️⃣ Тестирование API Telegram чатов...");
        
        const chatsResponse = await fetch("http://localhost:4000/api/telegram-chats", {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log("Chats Status:", chatsResponse.status);
        console.log("Chats Headers:", Object.fromEntries(chatsResponse.headers.entries()));

        if (chatsResponse.ok) {
          const chatsData = await chatsResponse.json();
          console.log("✅ API чатов работает!");
          console.log("Данные чатов:", JSON.stringify(chatsData, null, 2));
        } else {
          const error = await chatsResponse.text();
          console.log("❌ Ошибка API чатов:", error);
        }

        // 3. Тест с параметрами
        console.log("\n3️⃣ Тестирование API с параметрами...");
        
        const filteredResponse = await fetch("http://localhost:4000/api/telegram-chats?purpose=ads&active_only=true", {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log("Filtered Status:", filteredResponse.status);
        
        if (filteredResponse.ok) {
          const filteredData = await filteredResponse.json();
          console.log("✅ Фильтрация работает!");
          console.log("Отфильтрованные данные:", JSON.stringify(filteredData, null, 2));
        } else {
          const error = await filteredResponse.text();
          console.log("❌ Ошибка фильтрации:", error);
        }

      } else {
        console.log("❌ Неверный формат ответа авторизации");
      }
    } else {
      const error = await authResponse.text();
      console.log("❌ Ошибка авторизации:", error);
    }

  } catch (error) {
    console.error("❌ Ошибка подключения:", error.message);
  }
}

testTelegramAPI();
