#!/bin/sh
set -eu

check_password() {
  secret="$1"
  name="$2"
  case "$secret" in
    ''|CHANGER*) echo "$name is missing or still has its example value" >&2; exit 1 ;;
    *[!A-Za-z0-9_-]*) echo "$name must use URL-safe base64 characters" >&2; exit 1 ;;
  esac
  if [ "${#secret}" -lt 32 ]; then
    echo "$name must contain at least 32 characters" >&2
    exit 1
  fi
}

check_password "$POSTGRES_PASSWORD" POSTGRES_PASSWORD
check_password "$APP_DB_PASSWORD" APP_DB_PASSWORD
check_password "$MIGRATOR_DB_PASSWORD" MIGRATOR_DB_PASSWORD

if [ "$POSTGRES_PASSWORD" = "$APP_DB_PASSWORD" ] \
  || [ "$POSTGRES_PASSWORD" = "$MIGRATOR_DB_PASSWORD" ] \
  || [ "$APP_DB_PASSWORD" = "$MIGRATOR_DB_PASSWORD" ]; then
  echo "PostgreSQL admin, application, and migration passwords must be different" >&2
  exit 1
fi

case "$POSTGRES_USER" in
  stagetrack_app|stagetrack_migrator) echo "POSTGRES_USER must be distinct from the application roles" >&2; exit 1 ;;
esac

export PGPASSWORD="$POSTGRES_PASSWORD"
exec psql \
  -h postgres \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 \
  -v database_name="$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" \
  -v migrator_password="$MIGRATOR_DB_PASSWORD" \
  -f /provision/roles.sql
