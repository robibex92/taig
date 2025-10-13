# 🏗️ Taiginsky Backend - Clean Architecture

> Modern, scalable backend built with Clean Architecture principles

## 📋 Содержание

- [О проекте](#о-проекте)
- [Архитектура](#архитектура)
- [Технологии](#технологии)
- [Быстрый старт](#быстрый-старт)
- [Структура проекта](#структура-проекта)
- [API Документация](#api-документация)
- [Миграция](#миграция)
- [Тестирование](#тестирование)

---

## 🎯 О проекте

Backend приложения **Taiginsky** - платформа для управления объявлениями, новостями и взаимодействия с жильцами микрорайона.

### Основные возможности:

- 📢 **Объявления** (Ads) - создание, редактирование, удаление
- 📰 **Новости** (Posts) - публикация важных новостей
- 🏠 **Квартиры** (Houses) - управление информацией о жильцах
- 🚗 **Автомобили** (Cars) - регистрация машин жильцов
- 📸 **Изображения** (Ad Images) - загрузка и управление фото
- 💬 **Telegram интеграция** - автоматическая публикация в Telegram каналы
- ❓ **FAQ** - часто задаваемые вопросы
- 📊 **Категории** - классификация объявлений

---

## 🏗️ Архитектура

Проект построен на **Clean Architecture** с четким разделением на слои:

```
┌─────────────────────────────────────┐
│     Presentation Layer              │
│  (Controllers, Routes, Validation)  │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│      Application Layer              │
│    (Use Cases, Services, DTOs)      │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│    Infrastructure Layer             │
│  (Repositories, DB, External APIs)  │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│      Domain Layer                   │
│   (Entities, Interfaces, Rules)     │
└─────────────────────────────────────┘
```

### Принципы:

- ✅ **SOLID** principles
- ✅ **Dependency Injection**
- ✅ **Repository Pattern**
- ✅ **Use Case Pattern**
- ✅ **Clean separation of concerns**

---

## 🛠️ Технологии

### Core

- **Node.js** 18+ (ES Modules)
- **Express.js** - веб-фреймворк
- **PostgreSQL** - база данных
- **Prisma** - ORM (в процессе миграции)

### Validation & Security

- **Joi** - валидация данных
- **JWT** - аутентификация
- **bcrypt** - хеширование паролей
- **Helmet** - безопасность HTTP заголовков
- **CORS** - настройка cross-origin запросов
- **express-rate-limit** - защита от DDoS

### External Services

- **node-telegram-bot-api** - Telegram интеграция
- **Multer** - загрузка файлов
- **p-limit** - управление очередями задач

### Logging & Monitoring

- **Winston** - структурированное логирование
- **Swagger** - API документация

### Development

- **Nodemon** - hot reload
- **ESLint** - линтинг кода
- **Prettier** - форматирование кода
- **Jest** - тестирование (планируется)

---

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+
- PostgreSQL 14+
- npm или yarn

### 1. Установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка окружения

Создайте файл `.env` в корне `backend/`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/taiginsky"

# Server
PORT=4000
NODE_ENV=development

# JWT
JWT_ACCESS_SECRET=your_access_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_default_chat_id

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 3. Prisma настройка

```bash
# Генерация Prisma Client
npm run prisma:generate

# Применить миграции (опционально)
npm run prisma:migrate

# Открыть Prisma Studio для просмотра БД
npm run prisma:studio
```

### 4. Запуск сервера

```bash
# Development mode (hot reload)
npm run dev

# Production mode
npm start
```

Сервер запустится на `http://localhost:4000`

---

## 📁 Структура проекта

```
backend/
├── src/
│   ├── domain/                   # Domain Layer
│   │   ├── entities/            # Бизнес-сущности
│   │   └── repositories/        # Интерфейсы репозиториев
│   │
│   ├── application/             # Application Layer
│   │   ├── use-cases/          # Бизнес-логика (Use Cases)
│   │   └── services/           # Сервисы (Telegram, Token, etc.)
│   │
│   ├── infrastructure/          # Infrastructure Layer
│   │   ├── repositories/       # Реализации репозиториев
│   │   ├── database/           # Подключение к БД
│   │   ├── container/          # DI Container
│   │   └── swagger/            # Swagger конфигурация
│   │
│   ├── presentation/            # Presentation Layer
│   │   ├── controllers/        # HTTP контроллеры
│   │   ├── routes/             # Express routes
│   │   └── middlewares/        # Express middlewares
│   │
│   ├── core/                    # Core utilities
│   │   ├── errors/             # Кастомные ошибки
│   │   ├── middlewares/        # Core middlewares
│   │   ├── utils/              # Утилиты (logger, asyncHandler)
│   │   └── validation/         # Joi схемы валидации
│   │
│   └── server.js               # Точка входа приложения
│
├── prisma/
│   ├── schema.prisma           # Prisma схема
│   ├── schema_improved.prisma  # Улучшенная схема (для миграции)
│   └── migrations/             # SQL миграции
│
├── config/                      # Legacy конфигурация (to be removed)
├── routes/                      # Legacy routes (to be removed)
├── Uploads/                     # Загруженные файлы
├── logs/                        # Логи приложения
│
├── package.json
├── .env
└── README.md
```

---

## 📚 API Документация

### Swagger UI

После запуска сервера, Swagger UI доступен по адресу:

```
http://localhost:4000/api-docs
```

### Основные эндпоинты

#### 🔐 Auth

- `POST /api-v1/auth/telegram` - Telegram авторизация
- `POST /api-v1/auth/refresh` - Обновление токена

#### 📢 Ads (Объявления)

- `GET /api-v1/ads` - Список объявлений
- `GET /api-v1/ads/:id` - Одно объявление
- `POST /api-v1/ads` - Создать объявление
- `PATCH /api-v1/ads/:id` - Обновить объявление
- `DELETE /api-v1/ads/:id` - Удалить объявление

#### 📰 Posts (Новости)

- `GET /api-v1/posts` - Список новостей
- `POST /api-v1/posts` - Создать новость
- `PATCH /api-v1/posts/:id` - Обновить новость
- `DELETE /api-v1/posts/:id` - Удалить новость

#### 🏠 Nearby/Houses (Квартиры)

- `GET /api-v1/nearby/houses` - Список домов
- `GET /api-v1/nearby/entrances` - Подъезды дома
- `GET /api-v1/nearby` - Квартиры с фильтрацией
- `GET /api-v1/nearby/user/:id` - Квартиры пользователя
- `POST /api-v1/nearby` - Привязать квартиру
- `POST /api-v1/nearby/unlink` - Отвязать квартиру

#### 🚗 Cars (Автомобили)

- `GET /api-v1/cars` - Список автомобилей
- `GET /api-v1/cars/user/:id` - Автомобили пользователя
- `POST /api-v1/cars` - Добавить автомобиль
- `DELETE /api-v1/cars/:id` - Удалить автомобиль

#### 📸 Images

- `POST /api-v1/upload` - Загрузить изображения
- `DELETE /api-v1/upload/delete-image` - Удалить изображение
- `GET /api-v1/ad-images` - Изображения объявления
- `POST /api-v1/ad-images` - Создать изображения
- `DELETE /api-v1/ad-images/:id` - Удалить изображение

#### 📊 Categories

- `GET /api-v1/categories` - Список категорий
- `GET /api-v1/categories/:id/subcategories` - Подкатегории

#### ❓ FAQs

- `GET /api-v1/faqs` - Список FAQ
- `PATCH /api-v1/faqs/:id` - Обновить FAQ
- `DELETE /api-v1/faqs/:id` - Удалить FAQ

---

## 🔄 Миграция

Проект полностью мигрирован из legacy архитектуры в Clean Architecture.

### Документы миграции:

- `MIGRATION_COMPLETE.md` - полный отчет о миграции
- `MIGRATION_PROGRESS.md` - прогресс миграции
- `QUICK_START.md` - быстрый старт после миграции

### Статус: ✅ 100% завершено

Все legacy routes мигрированы:

- ✅ Posts
- ✅ Categories/Subcategories
- ✅ FAQs
- ✅ Floor Rules
- ✅ Cars
- ✅ Ad Images
- ✅ Upload
- ✅ Nearby/Houses

---

## 🧪 Тестирование

### Запуск тестов

```bash
# Unit тесты
npm test

# С покрытием
npm run test:coverage

# Watch mode
npm run test:watch
```

### Структура тестов

```
backend/tests/
├── unit/
│   ├── use-cases/
│   ├── services/
│   └── repositories/
└── integration/
    └── api/
```

---

## 🔧 Скрипты

```bash
# Development
npm run dev              # Запуск с hot reload

# Production
npm start                # Запуск production сервера

# Prisma
npm run prisma:generate  # Генерация Prisma Client
npm run prisma:migrate   # Применить миграции
npm run prisma:studio    # Открыть Prisma Studio
npm run prisma:pull      # Получить схему из БД
npm run prisma:push      # Отправить схему в БД

# Linting
npm run lint             # Проверка кода
npm run lint:fix         # Автофикс проблем

# Testing
npm test                 # Запуск тестов
npm run test:watch       # Тесты в watch mode
```

---

## 📝 Примеры использования

### Создание нового модуля

1. **Entity** (`src/domain/entities/`)

```javascript
export class MyEntity {
  constructor(data) {
    this.id = data.id;
    // ...
  }

  static fromDatabase(row) {
    return new MyEntity(row);
  }
}
```

2. **Repository Interface** (`src/domain/repositories/`)

```javascript
export class IMyRepository {
  async findAll() {
    throw new Error("Not implemented");
  }
}
```

3. **Repository Implementation** (`src/infrastructure/repositories/`)

```javascript
export class MyRepository extends IMyRepository {
  async findAll() {
    const { rows } = await pool.query("SELECT * FROM my_table");
    return rows.map((row) => MyEntity.fromDatabase(row));
  }
}
```

4. **Use Case** (`src/application/use-cases/my-module/`)

```javascript
export class GetMyEntitiesUseCase {
  constructor(myRepository) {
    this.myRepository = myRepository;
  }

  async execute(filters) {
    return await this.myRepository.findAll(filters);
  }
}
```

5. **Controller** (`src/presentation/controllers/`)

```javascript
export class MyController {
  constructor(getMyEntitiesUseCase) {
    this.getMyEntitiesUseCase = getMyEntitiesUseCase;
  }

  getAll = asyncHandler(async (req, res) => {
    const entities = await this.getMyEntitiesUseCase.execute(req.query);
    res.json({ success: true, data: entities });
  });
}
```

6. **Routes** (`src/presentation/routes/`)

```javascript
const router = express.Router();
const controller = container.resolve("myController");

router.get("/api-v1/my-entities", controller.getAll);

export default router;
```

7. **Register in Container** (`src/infrastructure/container/Container.js`)

```javascript
this.register("myRepository", () => new MyRepository());
this.register(
  "getMyEntitiesUseCase",
  (c) => new GetMyEntitiesUseCase(c.resolve("myRepository"))
);
this.register(
  "myController",
  (c) => new MyController(c.resolve("getMyEntitiesUseCase"))
);
```

---

## 🤝 Contributing

1. Создайте feature branch (`git checkout -b feature/amazing-feature`)
2. Commit изменения (`git commit -m 'Add amazing feature'`)
3. Push в branch (`git push origin feature/amazing-feature`)
4. Создайте Pull Request

### Стандарты кода:

- ESLint конфигурация проекта
- Prettier для форматирования
- Clean Architecture принципы
- SOLID принципы
- JSDoc комментарии для публичных методов

---

## 📄 Лицензия

Proprietary - Taiginsky Project

---

## 📞 Контакты

Вопросы и предложения: [your-email@example.com]

---

**Создано с ❤️ для Taiginsky community**
