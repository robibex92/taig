-- SQL скрипт для исправления прав доступа пользователя backend_user

-- 1. Подключитесь к базе данных от имени суперпользователя (postgres)
-- psql -U postgres -d mydatabase

-- 2. Дайте права пользователю backend_user на базу данных
GRANT ALL PRIVILEGES ON DATABASE mydatabase TO backend_user;

-- 3. Дайте права на схему public
GRANT ALL PRIVILEGES ON SCHEMA public TO backend_user;

-- 4. Дайте права на все существующие таблицы в схеме public
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO backend_user;

-- 5. Дайте права на все существующие последовательности (sequences)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO backend_user;

-- 6. Дайте права на все будущие таблицы и последовательности
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO backend_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO backend_user;

-- 7. Проверьте права
\du backend_user
\l mydatabase

