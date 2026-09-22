#!/bin/bash
# ATACS nightly backup (runs in the "backup" service of docker-compose.yml).
#   - database: mariadb-dump --single-transaction (no table locks; the app keeps running) → gzip
#   - uploaded photos: tar.gz of the uploads volume (read-only mount)
#   - keeps BACKUP_KEEP_DAYS days of files in ./backups on the host
# Manual run:  docker compose exec backup bash /backup.sh now
set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
AT="${BACKUP_TIME:-02:30}"

log() { echo "$(date '+%F %T') $*"; }

run_backup() {
  local stamp db_part db_file up_part up_file ok=0
  stamp="$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  db_part="$BACKUP_DIR/.atacs-db-$stamp.sql.gz.part"
  db_file="$BACKUP_DIR/atacs-db-$stamp.sql.gz"
  if MYSQL_PWD="$MYSQL_PASSWORD" mariadb-dump -h "${MYSQL_HOST:-db}" -u "$MYSQL_USER" \
      --single-transaction --quick --routines --triggers --hex-blob \
      --default-character-set=utf8mb4 "$MYSQL_DATABASE" | gzip -6 > "$db_part"; then
    mv "$db_part" "$db_file"
    log "database backup OK: $(basename "$db_file") ($(du -h "$db_file" | cut -f1))"
  else
    rm -f "$db_part"
    log "database backup FAILED"
    ok=1
  fi

  up_part="$BACKUP_DIR/.atacs-uploads-$stamp.tar.gz.part"
  up_file="$BACKUP_DIR/atacs-uploads-$stamp.tar.gz"
  if [ -d "$UPLOADS_DIR" ] && tar -czf "$up_part" -C "$UPLOADS_DIR" .; then
    mv "$up_part" "$up_file"
    log "uploads backup OK: $(basename "$up_file") ($(du -h "$up_file" | cut -f1))"
  else
    rm -f "$up_part"
    log "uploads backup FAILED"
    ok=1
  fi

  # Retention: only our own files, only after a run.
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'atacs-db-*.sql.gz' -o -name 'atacs-uploads-*.tar.gz' \) \
    -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/removed old backup: /'
  return $ok
}

if [ "${1:-}" = "now" ]; then
  run_backup
  exit $?
fi

if ! [[ "$AT" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]]; then
  log "BACKUP_TIME must be HH:MM (got '$AT'); using 02:30"
  AT="02:30"
fi
[ "${BACKUP_ON_START:-0}" = "1" ] && { sleep 30; run_backup; }

log "backup scheduler started: every day at $AT, keeping $KEEP_DAYS days in ./backups"
while true; do
  now="$(date +%s)"
  next="$(date -d "today $AT" +%s)"
  [ "$next" -le "$now" ] && next="$(date -d "tomorrow $AT" +%s)"
  sleep $((next - now))
  run_backup || true
  sleep 61
done
