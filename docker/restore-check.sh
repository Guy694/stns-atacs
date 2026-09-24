#!/bin/bash
# ซ้อมกู้คืนฐานข้อมูล ATACS — กู้ไฟล์สำรองลง "ฐานข้อมูลชั่วคราว" แล้วนับแถวเทียบกับฐานข้อมูลจริง
# ไม่แตะฐานข้อมูลที่ใช้งานอยู่ และลบฐานข้อมูลชั่วคราวทิ้งเมื่อเสร็จ
#
#   docker compose --env-file .env.docker exec backup bash /restore-check.sh                      # ไฟล์ล่าสุด
#   docker compose --env-file .env.docker exec backup bash /restore-check.sh /backups/atacs-db-XXXX.sql.gz
#
# ต้องใช้บัญชีที่สร้างฐานข้อมูลได้ (RESTORE_MYSQL_USER/RESTORE_MYSQL_PASSWORD เช่น root)
set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
HOST="${MYSQL_HOST:-db}"
USER="${RESTORE_MYSQL_USER:-$MYSQL_USER}"
PASSWORD="${RESTORE_MYSQL_PASSWORD:-$MYSQL_PASSWORD}"
SOURCE_DB="$MYSQL_DATABASE"
TEMP_DB="${RESTORE_TEMP_DB:-atacs_restore_check}"
# ตารางหลักที่ต้องมีข้อมูลหลังกู้คืน
TABLES="${RESTORE_CHECK_TABLES:-users health_facilities information_assets}"

log() { echo "$(date '+%F %T') $*"; }
sql() { MYSQL_PWD="$PASSWORD" mariadb -h "$HOST" -u "$USER" --default-character-set=utf8mb4 -N -B "$@"; }

FILE="${1:-}"
if [ -z "$FILE" ]; then
  FILE="$(ls -1t "$BACKUP_DIR"/atacs-db-*.sql.gz 2>/dev/null | head -1)"
fi
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  log "ไม่พบไฟล์สำรองใน $BACKUP_DIR"
  exit 1
fi

log "ไฟล์ที่จะทดสอบกู้คืน: $FILE"
if ! gzip -t "$FILE" 2>/dev/null; then
  log "FAILED: ไฟล์ gzip เสียหาย"
  exit 1
fi

cleanup() {
  sql -e "DROP DATABASE IF EXISTS \`$TEMP_DB\`" >/dev/null 2>&1
}
trap cleanup EXIT

log "สร้างฐานข้อมูลชั่วคราว $TEMP_DB"
if ! sql -e "DROP DATABASE IF EXISTS \`$TEMP_DB\`; CREATE DATABASE \`$TEMP_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"; then
  log "FAILED: สร้างฐานข้อมูลชั่วคราวไม่ได้ (ต้องใช้บัญชีที่มีสิทธิ์ CREATE DATABASE — ตั้ง RESTORE_MYSQL_USER/RESTORE_MYSQL_PASSWORD)"
  exit 1
fi

log "กำลังกู้คืน…"
if ! gzip -dc "$FILE" | MYSQL_PWD="$PASSWORD" mariadb -h "$HOST" -u "$USER" --default-character-set=utf8mb4 "$TEMP_DB"; then
  log "FAILED: กู้คืนไม่สำเร็จ"
  exit 1
fi

status=0
printf '%-28s %12s %12s %s\n' "ตาราง" "ในไฟล์สำรอง" "ในระบบจริง" "ผล"
for table in $TABLES; do
  restored="$(sql -e "SELECT COUNT(*) FROM \`$TEMP_DB\`.\`$table\`" 2>/dev/null || echo "-")"
  live="$(sql -e "SELECT COUNT(*) FROM \`$SOURCE_DB\`.\`$table\`" 2>/dev/null || echo "-")"
  verdict="ok"
  if [ "$restored" = "-" ] || [ "$restored" = "0" ]; then
    verdict="FAILED (ไม่มีข้อมูล)"
    status=1
  elif [ "$live" != "-" ] && [ "$restored" -lt "$live" ]; then
    # ข้อมูลที่เพิ่มหลังเวลาสำรองทำให้ตัวเลขต่างกันได้ตามปกติ เตือนเฉพาะเมื่อต่างเกิน 20%
    if [ "$live" -gt 0 ] && [ $(( (live - restored) * 100 / live )) -gt 20 ]; then
      verdict="ตรวจสอบ (ต่างจากระบบจริงมาก)"
    fi
  fi
  printf '%-28s %12s %12s %s\n' "$table" "$restored" "$live" "$verdict"
done

tables_restored="$(sql -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$TEMP_DB'")"
log "กู้คืนได้ $tables_restored ตาราง"
[ "$status" -eq 0 ] && log "RESTORE CHECK PASSED" || log "RESTORE CHECK FAILED"
exit $status
