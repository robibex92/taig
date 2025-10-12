#!/bin/bash

# ============================================
# Database Backup Script
# ============================================
# Usage: ./scripts/backup_database.sh [type]
# Types: full, schema, minimal
# ============================================

set -e

# Load .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set in .env"
  exit 1
fi

# Get backup type (default: full)
BACKUP_TYPE=${1:-full}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backups directory
mkdir -p backups

case $BACKUP_TYPE in
  full)
    echo "📦 Creating full database backup..."
    pg_dump "$DATABASE_URL" > "backups/full_backup_${TIMESTAMP}.sql"
    echo "✅ Full backup saved: backups/full_backup_${TIMESTAMP}.sql"
    ;;
    
  schema)
    echo "📦 Creating schema-only backup..."
    pg_dump --schema-only "$DATABASE_URL" > "backups/schema_${TIMESTAMP}.sql"
    echo "✅ Schema backup saved: backups/schema_${TIMESTAMP}.sql"
    ;;
    
  minimal)
    echo "📦 Creating minimal backup (without logs)..."
    pg_dump "$DATABASE_URL" \
      --exclude-table-data=telegram_messages \
      --exclude-table-data=refresh_tokens \
      > "backups/minimal_backup_${TIMESTAMP}.sql"
    echo "✅ Minimal backup saved: backups/minimal_backup_${TIMESTAMP}.sql"
    ;;
    
  *)
    echo "❌ Unknown backup type: $BACKUP_TYPE"
    echo "Usage: $0 [full|schema|minimal]"
    exit 1
    ;;
esac

# Keep only last 5 backups
echo "🧹 Cleaning old backups (keeping last 5)..."
cd backups
ls -t full_backup_*.sql 2>/dev/null | tail -n +6 | xargs -r rm
ls -t schema_*.sql 2>/dev/null | tail -n +6 | xargs -r rm
ls -t minimal_backup_*.sql 2>/dev/null | tail -n +6 | xargs -r rm
cd ..

echo "✅ Backup complete!"

