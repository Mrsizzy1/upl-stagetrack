#!/usr/bin/env sh
# Sauvegarde quotidienne : base PostgreSQL + photos. Conserve 30 jours.
# Planification (crontab de l'utilisateur root) :
#   15 22 * * *  /opt/upl-stagetrack/deploy/backup.sh /srv/sauvegardes/stagetrack >> /var/log/stagetrack-backup.log 2>&1
# Copier ensuite le dossier de sauvegarde HORS du serveur (disque externe, autre machine).
set -eu

DEST="${1:?Usage : backup.sh <dossier de destination>}"
cd "$(dirname "$0")/.."
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"

# Variables POSTGRES_* depuis le fichier d'environnement de production.
set -a
. deploy/.env.production
set +a

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner \
  > "$DEST/stagetrack-$STAMP.dump"

docker compose -f docker-compose.prod.yml exec -T api \
  tar -C /app/backend/storage -czf - . \
  > "$DEST/photos-$STAMP.tar.gz"

find "$DEST" -name 'stagetrack-*.dump' -mtime +30 -delete
find "$DEST" -name 'photos-*.tar.gz' -mtime +30 -delete
echo "Sauvegarde terminée : $DEST/stagetrack-$STAMP.dump"
