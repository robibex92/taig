/**
 * SQL Injection Protection Utilities
 *
 * Even though Prisma ORM provides protection against SQL injections,
 * this module provides additional utilities for raw queries if needed.
 */

import { Prisma } from "@prisma/client";
import { logger } from "./logger.js";

/**
 * Safely execute raw SQL query with parameters
 * Uses Prisma's parameterized queries
 *
 * @example
 * const users = await safeRawQuery(prisma)`
 *   SELECT * FROM users WHERE username = ${username}
 * `;
 */
export const safeRawQuery = (prisma) => {
  return (strings, ...values) => {
    // Log the query for audit
    logger.debug("Executing raw SQL query", {
      query: strings.join("?"),
      paramCount: values.length,
    });

    // Use Prisma's template literal syntax which handles parameterization
    return prisma.$queryRaw(strings, ...values);
  };
};

/**
 * Validate identifier (table name, column name)
 * Prevents SQL injection in dynamic identifiers
 */
export const validateIdentifier = (identifier) => {
  // Allow only alphanumeric, underscore, and dot
  const identifierPattern =
    /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;

  if (!identifierPattern.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }

  return identifier;
};

/**
 * Escape identifier for SQL
 * Use when you need to dynamically specify table or column names
 */
export const escapeIdentifier = (identifier) => {
  validateIdentifier(identifier);
  return `"${identifier}"`;
};

/**
 * Validate limit and offset for pagination
 */
export const validatePagination = (limit, offset) => {
  const limitNum = parseInt(limit);
  const offsetNum = parseInt(offset);

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
    throw new Error("Invalid limit: must be between 1 and 1000");
  }

  if (isNaN(offsetNum) || offsetNum < 0) {
    throw new Error("Invalid offset: must be non-negative");
  }

  return { limit: limitNum, offset: offsetNum };
};

/**
 * Best Practices for SQL Injection Prevention:
 *
 * 1. ALWAYS use Prisma's query builder methods (findMany, create, update, etc.)
 * 2. If you MUST use raw SQL:
 *    - Use $queryRaw with template literals (parameterized)
 *    - NEVER use $queryRawUnsafe
 *    - NEVER concatenate user input into SQL strings
 *
 * 3. For dynamic identifiers (table/column names):
 *    - Use validateIdentifier() or escapeIdentifier()
 *    - Keep a whitelist of allowed identifiers
 *
 * 4. For user input:
 *    - Always validate and sanitize before using
 *    - Use Joi schemas for validation
 *    - Use type checking (parseInt, parseFloat)
 *
 * 5. Logging:
 *    - Log all raw SQL queries for audit
 *    - Monitor for suspicious patterns
 */

// Example of SAFE raw query usage:
/*
const safeExample = async (prisma, userId) => {
  // GOOD - Parameterized
  const users = await prisma.$queryRaw`
    SELECT * FROM users WHERE user_id = ${userId}
  `;
  return users;
};
*/

// Example of UNSAFE raw query usage (DON'T DO THIS):
/*
const unsafeExample = async (prisma, userId) => {
  // BAD - SQL Injection vulnerable!
  const users = await prisma.$queryRawUnsafe(
    `SELECT * FROM users WHERE user_id = ${userId}`
  );
  return users;
};
*/

/**
 * Audit function to check codebase for unsafe SQL patterns
 * Run this during CI/CD
 */
export const auditSqlSafety = (codeContent) => {
  const unsafePatterns = [
    { pattern: /\$queryRawUnsafe/g, description: "Using $queryRawUnsafe" },
    { pattern: /\$executeRawUnsafe/g, description: "Using $executeRawUnsafe" },
    {
      pattern: /prisma\.\$queryRaw\([^`]/g,
      description: "Non-template literal $queryRaw",
    },
  ];

  const issues = [];

  for (const { pattern, description } of unsafePatterns) {
    const matches = codeContent.match(pattern);
    if (matches) {
      issues.push({
        description,
        count: matches.length,
        severity: "high",
      });
    }
  }

  return issues;
};

export default {
  safeRawQuery,
  validateIdentifier,
  escapeIdentifier,
  validatePagination,
  auditSqlSafety,
};
