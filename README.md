# Taiginsky Backend

> Node.js REST API with Clean Architecture

## 🏗️ Архитектура

```
backend/
├── src/
│   ├── core/              # Ядро приложения
│   │   ├── errors/        # Обработка ошибок
│   │   ├── utils/         # Утилиты
│   │   └── validation/    # Joi схемы
│   ├── domain/            # Доменная логика
│   │   ├── entities/      # Сущности
│   │   ├── errors/        # Доменные ошибки
│   │   └── repositories/  # Интерфейсы
│   ├── application/       # Бизнес-логика
│   │   ├── services/      # Сервисы
│   │   └── use-cases/     # Use Cases
│   ├── infrastructure/    # Внешние зависимости
│   │   ├── repositories/  # Реализация репозиториев
│   │   ├── logger/        # Winston logger
│   │   └── container/     # DI container
│   └── presentation/      # HTTP слой
│       ├── controllers/   # Контроллеры
│       ├── routes/        # Маршруты
│       └── middlewares/   # Middleware
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Миграции
└── server.js
```

## 🚀 Запуск

### Development

```bash
npm install
cp env.template .env
npx prisma migrate dev
npm run dev
```

### Production

```bash
npm install --production
npx prisma migrate deploy
npx pm2 start ecosystem.config.cjs
```

## 📡 API Endpoints

### Authentication

- `POST /api/auth/telegram` - Telegram OAuth
- `POST /api/auth/refresh` - Refresh token

### Ads (Объявления)

- `GET /api/ads` - Список объявлений
- `POST /api/ads` - Создать объявление
- `GET /api/ads/:id` - Детали объявления
- `PATCH /api/ads/:id` - Обновить объявление
- `DELETE /api/ads/:id` - Удалить объявление

### Posts (Новости)

- `GET /api/posts` - Список новостей
- `POST /api/posts` - Создать новость (admin/moderator)
- `PATCH /api/posts/:id` - Обновить новость (admin/moderator)
- `DELETE /api/posts/:id` - Удалить новость (admin/moderator)

### FAQs

- `GET /api/faqs` - Список FAQ
- `POST /api/faqs` - Создать FAQ (admin)
- `PATCH /api/faqs/:id` - Обновить FAQ (admin)
- `DELETE /api/faqs/:id` - Удалить FAQ (admin)

### Admin

- `GET /api/admin/users` - Список пользователей (admin)
- `PATCH /api/admin/users/:id/role` - Изменить роль (admin)
- `GET /api/admin/statistics` - Статистика (admin)

**Swagger:** http://localhost:4000/api-docs

## 🔐 Безопасность

### Реализовано

1. **SQL Injection** - Prisma ORM с параметризованными запросами
2. **XSS** - CSP от `helmet`, экранирование при сборке HTML-сообщений Telegram
3. **CSRF** - CORS настройка
4. **Rate Limiting** - `express-rate-limit`
5. **Idempotency** - `Idempotency-Key` header
6. **Input Validation** - Joi schemas
7. **JWT Auth** - Access + Refresh tokens

### Middleware

```javascript
// Защищенный маршрут
router.post(
  "/bookings",
  authenticateJWT, // JWT проверка
  idempotencyMiddleware, // Идемпотентность
  validationMiddleware(createBookingSchema), // Валидация
  bookingController.create
);
```

## 🗄️ База данных

### Prisma Commands

```bash
npx prisma migrate dev     # Создать и применить миграцию
npx prisma migrate deploy  # Применить на production
npx prisma generate        # Сгенерировать Prisma Client
npx prisma studio          # GUI для БД
npx prisma db seed         # Заполнить тестовыми данными
```

### Основные модели

- `User` - Пользователи
- `Ad` - Объявления
- `Post` - Новости
- `Booking` - Бронирования
- `Chat` / `Message` - Чаты
- `House` - Квартиры
- `FAQ` - FAQ

## 🤖 Telegram Bot

### Конфигурация

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Функции

- Публикация новостей в группы
- Отправка объявлений
- Управление топиками (threads)
- Редактирование/удаление сообщений

## 📊 PM2 (Production)

```bash
# Управление
npx pm2 start ecosystem.config.cjs
npx pm2 restart taig
npx pm2 stop taig
npx pm2 delete taig

# Логи
npx pm2 logs taig
npx pm2 logs taig --lines 100

# Мониторинг
npx pm2 list
npx pm2 monit
```

## 🧪 Тестирование

```bash
npm test              # Запустить тесты
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 📝 Переменные окружения

```env
# Server
PORT=4000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/taiginsky

# JWT
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Telegram
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# CORS
FRONTEND_URL=http://localhost:3000
```

## 🔄 Use Cases Pattern

```javascript
// Example: CreateAdUseCase
export class CreateAdUseCase {
  constructor(adRepository, imageService) {
    this.adRepository = adRepository;
    this.imageService = imageService;
  }

  async execute(adData, user) {
    // Validation
    if (!user) throw new UnauthorizedError();

    // Business logic
    const ad = await this.adRepository.create({
      ...adData,
      user_id: user.id,
      status: "active",
    });

    return ad;
  }
}
```

## 📚 Ресурсы

- [Полная документация](../PROJECT_DOCUMENTATION.md)
- [Prisma Docs](https://www.prisma.io/docs)
- [Express.js Docs](https://expressjs.com/)
