#!/bin/bash

###############################################################################
# Скрипт для настройки Prisma на сервере
# 
# Использование:
#   chmod +x scripts/setup-server.sh
#   ./scripts/setup-server.sh
#
# Что делает скрипт:
# 1. Проверяет наличие Node.js и npm
# 2. Устанавливает зависимости
# 3. Создает .env файл (если не существует)
# 4. Генерирует Prisma Client
# 5. Проверяет подключение к БД
# 6. Настраивает PM2
###############################################################################

set -e # Выход при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Настройка Prisma Backend для Taiginsky${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 1. Проверка Node.js
echo -e "${YELLOW}[1/7]${NC} Проверка Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    echo -e "Установите Node.js: https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js установлен: $NODE_VERSION${NC}"
echo ""

# 2. Проверка npm
echo -e "${YELLOW}[2/7]${NC} Проверка npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен!${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm установлен: $NPM_VERSION${NC}"
echo ""

# 3. Установка зависимостей
echo -e "${YELLOW}[3/7]${NC} Установка зависимостей..."
npm install
echo -e "${GREEN}✅ Зависимости установлены${NC}"
echo ""

# 4. Проверка .env файла
echo -e "${YELLOW}[4/7]${NC} Проверка .env файла..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env файл не найден${NC}"
    echo -e "Создаем из .env.example..."
    
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Создан .env файл${NC}"
        echo -e "${RED}⚠️  ВАЖНО: Отредактируйте .env файл с правильными данными!${NC}"
        echo ""
        read -p "Нажмите Enter после редактирования .env файла..."
    else
        echo -e "${RED}❌ .env.example не найден!${NC}"
        echo -e "Создайте .env файл вручную"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env файл существует${NC}"
fi
echo ""

# 5. Генерация Prisma Client
echo -e "${YELLOW}[5/7]${NC} Генерация Prisma Client..."
npx prisma generate
echo -e "${GREEN}✅ Prisma Client сгенерирован${NC}"
echo ""

# 6. Проверка подключения к БД
echo -e "${YELLOW}[6/7]${NC} Проверка подключения к БД..."
if node scripts/check-prisma.js; then
    echo -e "${GREEN}✅ Подключение к БД успешно${NC}"
else
    echo -e "${RED}❌ Ошибка подключения к БД${NC}"
    echo -e "Проверьте DATABASE_URL в .env файле"
    exit 1
fi
echo ""

# 7. Настройка PM2 (опционально)
echo -e "${YELLOW}[7/7]${NC} Настройка PM2..."
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 уже установлен${NC}"
    
    read -p "Запустить приложение с PM2? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Останавливаем старый процесс если существует
        pm2 delete taiginsky-backend 2>/dev/null || true
        
        # Запускаем новый
        pm2 start ecosystem.config.cjs --env production
        pm2 save
        
        echo -e "${GREEN}✅ Приложение запущено с PM2${NC}"
        echo -e "Просмотр логов: ${BLUE}pm2 logs taiginsky-backend${NC}"
        echo -e "Просмотр статуса: ${BLUE}pm2 status${NC}"
        echo -e "Мониторинг: ${BLUE}pm2 monit${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 не установлен${NC}"
    read -p "Установить PM2 глобально? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install -g pm2
        pm2 start ecosystem.config.cjs --env production
        pm2 startup
        pm2 save
        echo -e "${GREEN}✅ PM2 установлен и настроен${NC}"
    else
        echo -e "${YELLOW}Пропускаем установку PM2${NC}"
        echo -e "Для запуска приложения используйте: ${BLUE}npm start${NC}"
    fi
fi
echo ""

# Итоговое сообщение
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ Настройка завершена успешно! 🎉${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "Полезные команды:"
echo -e "  ${BLUE}npm start${NC}          - Запуск в production режиме"
echo -e "  ${BLUE}npm run dev${NC}        - Запуск в development режиме"
echo -e "  ${BLUE}pm2 status${NC}         - Статус PM2 процессов"
echo -e "  ${BLUE}pm2 logs${NC}           - Просмотр логов"
echo -e "  ${BLUE}pm2 restart all${NC}    - Перезапуск приложения"
echo ""
echo -e "Документация:"
echo -e "  ${BLUE}PRISMA_SETUP_GUIDE.md${NC} - Полное руководство по настройке"
echo ""

