#!/bin/bash
# ATACS nightly backup (runs in the "backup" service of docker-compose.yml).
#   - database: mariadb-dump --single-transaction (no table locks; the app keeps running) → gzip
#   - uploaded photos: tar.gz of the uploads volume (read-only mount)
#   - keeps BACKUP_KEEP_DAYS days of files in ./backups on the host
#   - verifies every dump (gzip integrity + "Dump completed" marker) before keeping it
#   - writes /backups/last-status.json, which /api/cron/backup-check reads and alerts on
# Manual run:  docker compose exec backup bash /backup.sh now
# Restore drill: docker compose exec backup bash /restore-check.sh <ไฟล์.sql.gz>
set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
AT="${BACKUP_TIME:-02:30}"

log() { echo "$(date '+%F %T') $*"; }

STATUS_FILE="$BACKUP_DIR/last-status.json"

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

write_status() {
  # $1 = ok|failed, $2 = ข้อความ, $3 = ไฟล์ฐานข้อมูล, $4 = ขนาด(ไบต์)
  mkdir -p "$BACKUP_DIR"
  cat > "$STATUS_FILE.part" <<JSON
{
  "state": "$(json_escape "$1")",
  "message": "$(json_escape "$2")",
  "databaseFile": "$(json_escape "$3")",
  "databaseBytes": ${4:-0},
  "finishedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
JSON
  mv "$STATUS_FILE.part" "$STATUS_FILE"
}

# ตรวจว่าไฟล์ dump ใช้กู้คืนได้จริง: gzip ไม่เสีย, มี CREATE TABLE, และจบด้วย marker ของ mariadb-dump
verify_dump() {
  local file="$1" min_bytes="${BACKUP_MIN_BYTES:-10240}" size
  size="$(stat -c %s "$file" 2>/dev/null || echo 0)"
  if [ "$size" -lt "$min_bytes" ]; then
    log "verify FAILED: $(basename "$file") มีขนาดเพียง $size ไบต์ (ต่ำกว่า $min_bytes)"
    return 1
  fi
  if ! gzip -t "$file" 2>/dev/null; then
    log "verify FAILED: $(basename "$file") ไฟล์ gzip เสียหาย"
    return 1
  fi
  if ! gzip -dc "$file" | grep -qm1 'CREATE TABLE'; then
    log "verify FAILED: $(basename "$file") ไม่พบ CREATE TABLE"
    return 1
  fi
  if ! gzip -dc "$file" | tail -5 | grep -qm1 'Dump completed'; then
    log "verify FAILED: $(basename "$file") ไม่จบด้วย \"Dump completed\" (dump ไม่สมบูรณ์)"
    return 1
  fi
  log "verify OK: $(basename "$file") ($size ไบต์)"
  return 0
}

run_backup() {
  local stamp db_part db_file up_part up_file ok=0
  stamp="$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  db_part="$BACKUP_DIR/.atacs-db-$stamp.sql.gz.part"
  db_file="$BACKUP_DIR/atacs-db-$stamp.sql.gz"
  local db_bytes=0 failure=""
  if MYSQL_PWD="$MYSQL_PASSWORD" mariadb-dump -h "${MYSQL_HOST:-db}" -u "$MYSQL_USER" \
      --single-transaction --quick --routines --triggers --hex-blob \
      --default-character-set=utf8mb4 "$MYSQL_DATABASE" | gzip -6 > "$db_part"; then
    if verify_dump "$db_part"; then
      mv "$db_part" "$db_file"
      db_bytes="$(stat -c %s "$db_file" 2>/dev/null || echo 0)"
      log "database backup OK: $(basename "$db_file") ($(du -h "$db_file" | cut -f1))"
    else
      # เก็บไฟล์ที่ตรวจไม่ผ่านไว้เป็น .bad เพื่อให้ตรวจสอบย้อนหลังได้ แต่ไม่นับเป็นไฟล์สำรองที่ใช้ได้
      mv "$db_part" "$db_file.bad"
      log "database backup FAILED: ไฟล์ตรวจสอบไม่ผ่าน เก็บไว้ที่ $(basename "$db_file").bad"
      failure="ไฟล์ dump ตรวจสอบไม่ผ่าน (ดู $(basename "$db_file").bad)"
      ok=1
    fi
  else
    rm -f "$db_part"
    log "database backup FAILED"
    failure="mariadb-dump ล้มเหลว"
    ok=1
  fi

  up_part="$BACKUP_DIR/.atacs-uploads-$stamp.tar.gz.part"
  up_file="$BACKUP_DIR/atacs-uploads-$stamp.tar.gz"
  if [ -d "$UPLOADS_DIR" ] && tar -czf "$up_part" -C "$UPLOADS_DIR" . && gzip -t "$up_part" 2>/dev/null; then
    mv "$up_part" "$up_file"
    log "uploads backup OK: $(basename "$up_file") ($(du -h "$up_file" | cut -f1))"
  else
    rm -f "$up_part"
    log "uploads backup FAILED"
    failure="${failure:+$failure · }สำรองไฟล์รูปภาพล้มเหลว"
    ok=1
  fi

  # Retention: only our own files, only after a run.
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'atacs-db-*.sql.gz' -o -name 'atacs-uploads-*.tar.gz' \) \
    -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/removed old backup: /'

  if [ "$ok" -eq 0 ]; then
    write_status "ok" "สำรองข้อมูลและตรวจสอบไฟล์สำเร็จ" "$(basename "$db_file")" "$db_bytes"
  else
    write_status "failed" "${failure:-สำรองข้อมูลล้มเหลว}" "" 0
  fi
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
