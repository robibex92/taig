#!/usr/bin/env node

/**
 * Prisma Health Check Script
 *
 * Проверяет состояние Prisma и подключение к БД
 *
 * Использование:
 * node scripts/check-prisma.js
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../src/core/utils/logger.js";

const prisma = new PrismaClient();

async function checkPrisma() {
  console.log("🔍 Checking Prisma configuration...\n");

  try {
    // 1. Проверка подключения
    console.log("1️⃣ Testing database connection...");
    await prisma.$connect();
    console.log("   ✅ Connection successful\n");

    // 2. Простой запрос
    console.log("2️⃣ Testing simple query...");
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log("   ✅ Query successful:", result);
    console.log("");

    // 3. Проверка таблиц
    console.log("3️⃣ Checking database tables...");
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log(`   ✅ Found ${tables.length} tables:`);
    tables.forEach((table) => {
      console.log(`      - ${table.table_name}`);
    });
    console.log("");

    // 4. Статистика соединений
    console.log("4️⃣ Checking connection statistics...");
    const stats = await prisma.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database();
    `;
    console.log("   ✅ Connection statistics:");
    console.log(`      Total: ${stats[0].total_connections}`);
    console.log(`      Active: ${stats[0].active_connections}`);
    console.log(`      Idle: ${stats[0].idle_connections}`);
    console.log("");

    // 5. Версия PostgreSQL
    console.log("5️⃣ Checking PostgreSQL version...");
    const version = await prisma.$queryRaw`SELECT version();`;
    console.log("   ✅ PostgreSQL version:");
    console.log(`      ${version[0].version}`);
    console.log("");

    // 6. Проверка основных таблиц
    console.log("6️⃣ Checking main tables data...");

    const usersCount = await prisma.user.count();
    console.log(`   ✅ Users: ${usersCount}`);

    const adsCount = await prisma.ad.count();
    console.log(`   ✅ Ads: ${adsCount}`);

    const postsCount = await prisma.post.count();
    console.log(`   ✅ Posts: ${postsCount}`);

    const categoriesCount = await prisma.category.count();
    console.log(`   ✅ Categories: ${categoriesCount}`);

    console.log("");

    // 7. Проверка индексов
    console.log("7️⃣ Checking indexes...");
    const indexes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    console.log(`   ✅ Found ${indexes.length} indexes`);
    console.log("");

    // Итоговое сообщение
    console.log("✅ =====================================");
    console.log("✅ All Prisma checks passed! 🎉");
    console.log("✅ =====================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Prisma check failed!\n");
    console.error("Error:", error.message);
    console.error("");

    if (error.code === "P1001") {
      console.error("💡 Tip: Cannot reach database server.");
      console.error("   - Check if DATABASE_URL is correct");
      console.error("   - Check if database server is running");
      console.error("   - Check network connectivity");
    } else if (error.code === "P1002") {
      console.error("💡 Tip: Database server timeout.");
      console.error("   - Database might be overloaded");
      console.error("   - Try increasing connect_timeout in DATABASE_URL");
    } else if (error.code === "P1003") {
      console.error("💡 Tip: Database does not exist.");
      console.error("   - Check DATABASE_URL database name");
    } else if (error.code === "P1010") {
      console.error("💡 Tip: Authentication failed.");
      console.error("   - Check username/password in DATABASE_URL");
    }

    console.error("");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем проверку
checkPrisma();
