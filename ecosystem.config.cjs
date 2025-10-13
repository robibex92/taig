/**
 * PM2 Ecosystem Configuration
 *
 * Используется для управления Node.js процессом на production сервере
 *
 * Команды:
 * - pm2 start ecosystem.config.cjs --env production
 * - pm2 restart taiginsky-backend
 * - pm2 stop taiginsky-backend
 * - pm2 logs taiginsky-backend
 * - pm2 monit
 */

module.exports = {
  apps: [
    {
      // Имя приложения
      name: "taiginsky-backend",

      // Скрипт для запуска
      script: "./src/server.js",

      // Рабочая директория
      cwd: "./",

      // Аргументы
      args: "",

      // Количество инстансов
      // 'max' - по количеству CPU ядер
      // число - конкретное количество
      instances: 1, // Начните с 1, потом увеличьте если нужно

      // Режим запуска
      // 'cluster' - для использования всех ядер
      // 'fork' - обычный режим
      exec_mode: "fork",

      // Автоматический рестарт при падении
      autorestart: true,

      // Задержка перед автоматическим перезапуском (мс)
      restart_delay: 4000,

      // Максимальное количество рестартов за 1 минуту
      max_restarts: 10,

      // Минимальное время работы для того чтобы считаться "запущенным"
      min_uptime: "10s",

      // Максимальное использование памяти перед рестартом (опционально)
      max_memory_restart: "500M",

      // Watch & Reload (отключено для production)
      watch: false,

      // Игнорировать файлы при watch (если включен)
      ignore_watch: ["node_modules", "logs", "uploads", ".git"],

      // Переменные окружения
      env: {
        NODE_ENV: "development",
        PORT: 4000,
      },

      env_production: {
        NODE_ENV: "production",
        PORT: 4000,
      },

      // Логи
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",

      // Формат времени в логах
      time: true,

      // Объединить логи из всех инстансов
      merge_logs: true,

      // Логирование
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Graceful shutdown
      kill_timeout: 5000,

      // Интерпретатор
      interpreter: "node",

      // Аргументы интерпретатора
      interpreter_args: "--max-old-space-size=512",

      // Cron для перезапуска (опционально)
      // cron_restart: '0 3 * * *', // Каждый день в 3:00

      // Post-deploy hooks
      post_update: ["npm install", "npx prisma generate"],
    },
  ],

  // Deploy configuration (опционально)
  deploy: {
    production: {
      // SSH user
      user: "deploy",

      // SSH host
      host: ["your-server.com"],

      // SSH port
      // port: '22',

      // Git remote/branch
      ref: "origin/main",
      repo: "git@github.com:username/repository.git",

      // Path on server
      path: "/var/www/taiginsky",

      // SSH options
      ssh_options: "StrictHostKeyChecking=no",

      // Pre-deploy commands
      "pre-deploy": "git fetch --all",

      // Post-deploy commands
      "post-deploy":
        "npm install && npx prisma generate && pm2 reload ecosystem.config.cjs --env production && pm2 save",

      // Environment variables
      env: {
        NODE_ENV: "production",
      },
    },
  },
};
