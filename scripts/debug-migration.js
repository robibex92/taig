import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationPath = path.join(
  __dirname,
  "../prisma/migrations/enhance_events_system.sql"
);
const migrationSQL = fs.readFileSync(migrationPath, "utf8");

console.log("=== ИСХОДНЫЙ SQL ===");
console.log(migrationSQL);

console.log("\n=== РАЗБИТЫЕ STATEMENTS ===");
const statements = migrationSQL
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

statements.forEach((statement, index) => {
  console.log(`\n--- STATEMENT ${index + 1} ---`);
  console.log(statement);
  console.log(`Длина: ${statement.length}`);
});
