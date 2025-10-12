#!/bin/bash

# ============================================
# Database Restore Script
# ============================================
# Usage: ./scripts/restore_database.sh <backup_file.sql>
# ============================================

set -e

# Check if backup file provided
if [ -z "$1" ]; then
  echo "❌ ERROR: Please provide backup file"
  echo "Usage: $0 <backup_file.sql>"
  echo ""
  echo "Available backups:"
  ls -lh backups/*.sql 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_FILE=$1

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set in .env"
  exit 1
fi

# Warning
echo "⚠️  WARNING: This will REPLACE all data in the database!"
echo "Database: $DATABASE_URL"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "❌ Restore cancelled"
  exit 1
fi

echo "🔄 Restoring database from backup..."
psql "$DATABASE_URL" < "$BACKUP_FILE"

echo "✅ Database restored successfully!"
echo "🔄 Regenerating Prisma Client..."
npx prisma generate

echo "✅ All done!"

