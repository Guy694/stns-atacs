# ติดตั้ง ATACS บน Linux server ด้วย Docker (ย้ายจาก Vercel)

โครงสร้าง (`docker-compose.yml`):

| service | หน้าที่ |
|---|---|
| `db`   | MariaDB 10.11 เก็บข้อมูลใน volume `db_data` (เปิดพอร์ตเฉพาะ `127.0.0.1:3307`) |
| `app`  | Next.js (standalone) พอร์ต 3000 ภายใน รูปครุภัณฑ์เก็บใน volume `uploads` (`/app/storage/uploads`) และเปิดดูได้เฉพาะผู้ที่ล็อกอินและมีสิทธิ์หน่วยงานนั้น |
| `web`  | Caddy reverse proxy: HTTPS อัตโนมัติ (Let's Encrypt) ส่งทุกคำขอให้ `app` |
| `cron` | แทน Vercel Cron: `/api/cron/agent-health` ทุก `CRON_INTERVAL_SECONDS` และสรุปงานค้างทาง Telegram วันละครั้งเวลา `DAILY_SUMMARY_TIME` |
| `backup` | สำรองฐานข้อมูล + รูปภาพทุกคืนเวลา `BACKUP_TIME` ลงโฟลเดอร์ `./backups` เก็บย้อนหลัง `BACKUP_KEEP_DAYS` วัน |

ความต่างจาก Vercel ที่ต้องรู้:
- รูปภาพครุภัณฑ์ที่อัปโหลดจะถูกเก็บถาวรใน volume `uploads` (บน Vercel ระบบไฟล์เป็น read-only จึงเก็บไม่ได้)
- คำสั่งติดตั้ง Agent ใช้ `APP_URL` (ฝังตอน build) — เครื่องที่ติดตั้ง Agent ไว้แล้วยังส่งข้อมูลไป URL เดิม ดูขั้นที่ 8 (ย้าย Agent)
- ต้องแก้ Callback URL ของ ThaiD และ Google เป็นโดเมนใหม่

## 1) เตรียมเครื่อง (Ubuntu 22.04/24.04)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version            # ต้องเป็น v2.x
```

เปิด firewall พอร์ต 80 และ 443 (ถ้าใช้ HTTPS สาธารณะ) และชี้ DNS ของโดเมนมาที่เครื่องนี้ก่อนเริ่ม

## 2) นำโค้ดขึ้นเครื่องและตั้งค่า

```bash
git clone <repo-url> /opt/atacs && cd /opt/atacs      # หรือคัดลอกโฟลเดอร์โปรเจกต์ (ไม่ต้องเอา node_modules, .next)
cp docker/env.example .env.docker
nano .env.docker                                       # กรอกค่าจริง (คัดลอกจาก Vercel → Settings → Environment Variables)
chmod 600 .env.docker
```

ค่าที่ต้องเหมือน Vercel เดิม: `AUTH_SECRET`, `THAID_CID_HASH_KEY` (ถ้าเปลี่ยน ผู้ใช้ ThaiD เดิมจะจับคู่บัญชีไม่ได้), ค่า ThaiD/Google/Telegram
ค่าที่ต้องเปลี่ยน: `APP_URL`, `SITE_ADDRESS`, `CALLBACK`, `GOOGLE_CALLBACK_URL`, รหัสผ่านฐานข้อมูล

ใช้ภายในเครือข่ายโดยไม่มีโดเมน/HTTPS: ตั้ง `SITE_ADDRESS=:80`, `APP_URL=http://<IP เครื่อง>` และ `AUTH_COOKIE_SECURE=false` (ไม่เช่นนั้นเบราว์เซอร์จะไม่เก็บ cookie และล็อกอินไม่ติด)

## 3) นำข้อมูลเดิมเข้า

Export จากฐานข้อมูลเดิม (phpMyAdmin → Export → SQL หรือคำสั่งด้านล่าง) แล้วตรวจว่าไฟล์ไม่ใช่ 0 ไบต์

```bash
# จากเครื่องเดิม (XAMPP บน Windows ใช้ C:\xampp\mysql\bin\mysqldump.exe)
mysqldump -u root -p --single-transaction --routines --default-character-set=utf8mb4 stn_atacs > stn_atacs.sql
```

**วิธี ก (แนะนำ, ก่อนเริ่มครั้งแรก):** คัดลอกไฟล์ไปไว้ที่ `docker/initdb/01-stn_atacs.sql` แล้วไปขั้นที่ 4 — MariaDB จะโหลดให้อัตโนมัติ

**วิธี ข (ฐานข้อมูลเริ่มแล้ว):**
```bash
docker compose --env-file .env.docker up -d db
docker compose --env-file .env.docker exec -T db sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' < stn_atacs.sql
```

## 4) Build และเริ่มระบบ

```bash
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps                # app ต้องเป็น healthy
docker compose --env-file .env.docker logs -f app web   # ดู log (Ctrl+C ออก)
```

ตรวจฐานข้อมูลและ migration (อ่านอย่างเดียว):
```bash
docker compose --env-file .env.docker exec app node scripts/check-database.mjs
```
ถ้ารายงานว่ายังขาด migration ให้รันไฟล์ที่ระบุ เช่น
```bash
docker compose --env-file .env.docker exec -T db sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' < database/add_inspection_found_location.sql
```

## 4.1) งานความปลอดภัยที่ต้องทำครั้งเดียว (ก.ย. 2569)

หลังอัปเดตรอบแก้ SEC-01 – SEC-07 มี 4 อย่างที่ต้องทำด้วยมือ

1. **รัน migration ของการผูก ThaiD** (SEC-04) — ปลอดภัยต่อการรันซ้ำ สำรองฐานข้อมูลก่อน
   ```bash
   docker compose --env-file .env.docker exec backup bash /backup.sh now
   docker compose --env-file .env.docker exec -T db sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' < database/add_thaid_link_approval.sql
   ```
   หลังรันแล้ว บัญชีเดิมจะผูก ThaiD ครั้งแรกไม่ได้จนกว่าแอดมินจะกด “อนุญาตให้เชื่อมต่อ ThaiD ครั้งแรก”
   ในหน้า จัดการผู้ใช้งาน (บัญชีบทบาทแอดมินผูกอัตโนมัติไม่ได้ในทุกกรณี)

2. **ตรวจบัญชีจากไฟล์ seed** (SEC-05) — รัน `database/check_seed_accounts.sql` ใน phpMyAdmin
   ถ้าพบบัญชีที่ไม่ได้ใช้งานจริง ให้ปิดใช้งานหรือล้างรหัสผ่าน (อย่าปิดแอดมินบัญชีสุดท้าย)
   ไฟล์ `database/seed_*.sql`, `database/stn_atacs.sql`, `.vscode/` ถูกถอดออกจาก git แล้ว
   แต่ยังอยู่ใน git history — ต้องลบด้วย `git filter-repo` และเปลี่ยนรหัสผ่าน/ข้อมูลที่รั่วเอง

3. **ตั้งคีย์ติดตั้ง Agent แบบผูกหน่วยงาน** (SEC-03) ใน `.env.docker`
   ```env
   ATACS_AGENT_INSTALL_KEY=12:คีย์ของหน่วยงาน12,34:คีย์ของหน่วยงาน34
   ```
   คีย์ที่ไม่มี `<facilityId>:` นำหน้าจะใช้ได้ทุกหน่วยงาน (แบบเดิม) — ควรเลิกใช้
   การลงทะเบียน Agent ถูกจำกัดไว้ที่ 10 ครั้ง/10 นาที/IP

4. **จำกัดปลายทางที่ประกาศให้ Agent ย้ายไป** (SEC-06) ใน `.env.docker`
   ```env
   AGENT_API_BASE_URL=https://atacs.<โดเมนของคุณ>
   AGENT_API_BASE_ALLOWED_HOSTS=atacs.<โดเมนของคุณ>
   ```
   เว้นว่าง `AGENT_API_BASE_ALLOWED_HOSTS` = ไม่ประกาศที่อยู่ใหม่เลย (ค่าเริ่มต้นที่ปลอดภัยที่สุด)
   ฝั่งสคริปต์ agent ยอมย้ายเฉพาะ `https://` และโฮสต์ที่ลงท้ายด้วย `.moph.go.th` หรือโฮสต์เดิมที่ใช้อยู่
   ถ้าใช้โดเมนอื่น ต้องแก้ `ALLOWED_API_HOST_SUFFIXES` ใน `public/agent/linux/atacs-agent.py`
   และ `$allowedSuffixes` ใน `public/agent/windows/atacs-agent.ps1` แล้วให้เครื่องลูกข่ายอัปเดตสคริปต์

## 4.2) การสำรองข้อมูลและการเฝ้าระวัง (ก.ย. 2569)

- ทุกรอบสำรองจะ **ตรวจไฟล์ก่อนเก็บ** (gzip ไม่เสีย, มี CREATE TABLE, จบด้วย "Dump completed")
  ไฟล์ที่ตรวจไม่ผ่านจะถูกเปลี่ยนชื่อเป็น `.bad` และไม่ถูกนับว่าเป็นไฟล์สำรองที่ใช้ได้
- สถานะรอบล่าสุดเขียนไว้ที่ `./backups/last-status.json` และ `/api/cron/backup-check`
  (คอนเทนเนอร์ cron เรียกวันละครั้ง) จะแจ้ง Telegram เมื่อไม่มีไฟล์สำรอง ไฟล์เก่าเกิน `BACKUP_MAX_AGE_HOURS`
  ไฟล์เล็กผิดปกติ หรือรอบล่าสุดล้มเหลว — ตรวจเองได้ด้วย
  ```bash
  curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/backup-check?dry=1"
  ```
- **ซ้อมกู้คืนอย่างน้อยไตรมาสละครั้ง** (กู้ลงฐานข้อมูลชั่วคราว ไม่แตะฐานข้อมูลจริง):
  ```bash
  docker compose --env-file .env.docker exec backup bash /restore-check.sh
  ```
  ต้องตั้ง `RESTORE_MYSQL_USER` / `RESTORE_MYSQL_PASSWORD` เป็นบัญชีที่มีสิทธิ์ `CREATE DATABASE`
  สคริปต์จะนับแถวในตารางหลักเทียบกับระบบจริงแล้วสรุปว่า PASSED หรือ FAILED
- ข้อผิดพลาดของระบบถูกบันทึกเป็น log แบบ JSON (`{"tag":"atacs-error",…}`) ดูด้วย
  `docker compose logs app | grep atacs-error` และแจ้ง Telegram หมวด "ข้อผิดพลาดของระบบ"
  โดยข้อผิดพลาดเดียวกันจะแจ้งไม่เกิน 1 ครั้งต่อ `ERROR_ALERT_WINDOW_MINUTES` นาที
- ถ้ายังไม่ได้รัน migration ครบ ผู้ดูแลระบบจะเห็น **แถบเตือนสีเหลืองด้านบนทุกหน้า** บอกชื่อไฟล์ที่ยังขาด
  (เดิมหน้าเหล่านั้นจะแสดงข้อมูลว่างเงียบ ๆ)

## 5) ย้ายรูปภาพเดิม (ถ้ามี)

รูปครุภัณฑ์เก็บนอก `public/` แล้ว (เปิดได้เฉพาะผู้ที่ล็อกอิน) คัดลอกรูปเดิมเข้า volume:
```bash
docker compose --env-file .env.docker cp ./public/uploads/assets/. app:/app/storage/uploads/assets/
docker compose --env-file .env.docker exec -u 0 app chown -R 1001:1001 /app/storage/uploads
```
บนเครื่อง XAMPP/Windows (ไม่ใช้ Docker) รูปใหม่จะเก็บที่ `storage\uploads\assets` ส่วนรูปเดิมใน `public\uploads\assets` ยังแสดงได้
แต่เปิดได้โดยไม่ต้องล็อกอิน — ย้ายด้วย `node scripts/move-legacy-uploads.mjs --apply` (คัดลอกอย่างเดียว) ตรวจรูปในระบบ แล้วลบโฟลเดอร์ `public\uploads\assets` เอง

## 6) สำรองข้อมูล (อัตโนมัติ)

service `backup` ทำงานทุกคืนเวลา `BACKUP_TIME` (ค่าเริ่มต้น 02:30) ได้ไฟล์ใน `./backups`:
`atacs-db-YYYYMMDD-HHMMSS.sql.gz` (ใช้ `--single-transaction` ระบบไม่ต้องหยุด) และ `atacs-uploads-YYYYMMDD-HHMMSS.tar.gz`
ไฟล์เก่ากว่า `BACKUP_KEEP_DAYS` วันถูกลบเฉพาะไฟล์สำรองของระบบเอง

```bash
docker compose --env-file .env.docker exec backup bash /backup.sh now   # สำรองทันที (เช่น ก่อนรัน migration)
docker compose --env-file .env.docker logs backup                        # ผลการสำรองแต่ละคืน
ls -lh backups/
```
ควรคัดลอก `./backups` ออกนอกเครื่อง (NAS/อีกเครื่อง) เป็นประจำ หรือกำหนด `BACKUP_HOST_DIR` เป็นโฟลเดอร์ NAS ที่ mount ไว้

กู้คืน (ทดสอบกู้บนเครื่องทดลองอย่างน้อยปีละครั้ง):
```bash
gunzip -c backups/atacs-db-20260101-023000.sql.gz | docker compose --env-file .env.docker exec -T db sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"'
docker run --rm -v atacs_uploads:/data -v "$PWD/backups":/b alpine sh -c 'tar xzf /b/atacs-uploads-20260101-023000.tar.gz -C /data && chown -R 1001:1001 /data'
```

## 7) อัปเดตเวอร์ชัน

```bash
cd /opt/atacs && git pull
docker compose --env-file .env.docker exec app node scripts/check-database.mjs   # ดูว่ามี migration ใหม่ไหม (สำรองก่อนรัน)
docker compose --env-file .env.docker up -d --build app
```

## 8) ย้าย Agent จาก Vercel มาเครื่องใหม่

Agent เวอร์ชัน 1.1 ขึ้นไปจะเปลี่ยนที่อยู่ปลายทางเองเมื่อเซิร์ฟเวอร์แจ้ง ส่วนเครื่องที่ติดตั้งรุ่นเก่าต้องสั่งย้ายครั้งเดียว

1. **บน Vercel (เซิร์ฟเวอร์เดิม)** ตั้ง Environment Variable `AGENT_API_BASE_URL=https://<โดเมนใหม่>` แล้ว Redeploy
   (Agent 1.1+ ที่ส่งข้อมูลเข้ามาจะบันทึกที่อยู่ใหม่และส่งไปเครื่องใหม่ตั้งแต่รอบถัดไป) — ไม่ต้องตั้งค่านี้บนเครื่องใหม่
2. **เครื่องที่ติดตั้ง Agent รุ่นเก่า** รันคำสั่งย้ายครั้งเดียว (ใช้ Agent ID/Key เดิม ข้อมูลเครื่องไม่หาย):
   - Windows (PowerShell แบบ Administrator):
     ```powershell
     $base='https://<โดเมนใหม่>'; iwr "$base/agent/windows/repoint-atacs-agent.ps1" -UseBasicParsing -OutFile "$env:TEMP\repoint-atacs-agent.ps1"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\repoint-atacs-agent.ps1" -ApiBaseUrl $base
     ```
   - Linux:
     ```bash
     base=https://<โดเมนใหม่>; curl -fsSL "$base/agent/linux/repoint-atacs-agent.sh" | sudo bash -s -- "$base"
     ```
   สคริปต์จะสำรอง `agent-config.json` เป็น `.bak` แก้ `apiBaseUrl` ดาวน์โหลด Agent รุ่นใหม่ และส่งข้อมูล 1 รอบทันที
3. ตรวจที่หน้า Agent ของระบบใหม่ว่าเครื่องกลับมาออนไลน์ เมื่อครบทุกเครื่องแล้วจึงปิดโปรเจกต์บน Vercel

## 9) สรุปงานค้างทาง Telegram รายวัน

ตั้ง `CRON_SECRET` และ `TELEGRAM_*` แล้ว service `cron` จะเรียก `/api/cron/daily-summary` วันละครั้งเวลา `DAILY_SUMMARY_TIME`
(ส่งไม่เกินวันละ 1 ข้อความ และไม่ส่งถ้าไม่มีงานค้าง) รายการที่สรุป: ยืมเกินกำหนดคืน, รอบตรวจนับใกล้ครบ/เกินกำหนดรายงาน 30 วันทำการ,
ประกัน/สัญญา MA หมดใน 30 วัน, คำขอจำหน่ายรออนุมัติเกิน 7 วัน, งานซ่อมค้างเกิน 14 วัน
ปรับเกณฑ์ได้ด้วย `SUMMARY_WARRANTY_DAYS`, `SUMMARY_DISPOSAL_PENDING_DAYS`, `SUMMARY_REPAIR_OPEN_DAYS`, `SUMMARY_INSPECTION_WARN_DAYS` (เพิ่มใน `app.environment`)
ทดสอบโดยไม่ส่งข้อความ:
```bash
docker compose --env-file .env.docker exec cron sh -c 'curl -s -H "Authorization: Bearer $CRON_SECRET" "http://app:3000/api/cron/daily-summary?dry=1"'
```

## 10) CI (GitHub Actions)

`.github/workflows/ci.yml` รัน lint, type check, unit + integration test กับ MariaDB 10.11, `next build` และ build Docker image ทุกครั้งที่ push/PR
รัน integration test บนเครื่องตัวเอง (สร้างและลบฐานข้อมูลทดสอบ `atacs_*_test` เอง ไม่แตะฐานจริง):
```bash
ATACS_TEST_MYSQL_PORT=3306 ATACS_TEST_MYSQL_USER=root ATACS_TEST_MYSQL_PASSWORD= npm run test:integration
```

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ล็อกอินแล้วเด้งกลับหน้า login | ใช้ HTTP แต่ไม่ได้ตั้ง `AUTH_COOKIE_SECURE=false` |
| ThaiD / Google แจ้ง redirect_uri ไม่ตรง | แก้ `CALLBACK` / `GOOGLE_CALLBACK_URL` และลงทะเบียน URL ใหม่ที่ผู้ให้บริการ |
| รูปครุภัณฑ์ไม่แสดง | ต้องล็อกอินก่อน · ตรวจว่า volume `uploads` mount ที่ `/app/storage/uploads` และไฟล์เป็นของ uid 1001 · รูปที่ไม่ผูกกับครุภัณฑ์ใดจะไม่แสดง |
| Agent เครื่องเก่ายังส่งไป Vercel | รันคำสั่งในขั้นที่ 8 บนเครื่องนั้น หรือตั้ง `AGENT_API_BASE_URL` บน Vercel (ได้ผลกับ Agent 1.1+) |
| ไม่ได้รับสรุป Telegram | `docker compose logs cron` · ต้องมี `CRON_SECRET` และ Telegram ตั้งค่าแล้ว · วันนั้นอาจไม่มีงานค้าง |
| Caddy ขอใบรับรองไม่ได้ | DNS ยังไม่ชี้มาที่เครื่อง หรือพอร์ต 80/443 ถูกปิด |
| app ไม่ healthy | `docker compose logs app` มักเป็นค่า `.env.docker` ขาด (เช่น `AUTH_SECRET`) หรือต่อฐานข้อมูลไม่ได้ |
