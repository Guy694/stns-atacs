# ตรวจรับก่อนใช้งานจริง (หลังอัปเดตรอบสติ๊กเกอร์ A4 / ออฟไลน์ / แผนทดแทน / Docker)

สำรองฐานข้อมูลก่อนเสมอ รอบนี้ **ไม่มี migration ใหม่** (ถ้ายังไม่ได้รัน `database/add_inspection_found_location.sql` ให้รันก่อน)

## บนเครื่องพัฒนา (XAMPP)
- [ ] `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build` ผ่านทั้งหมด
- [ ] `ATACS_TEST_MYSQL_PORT=3306 ATACS_TEST_MYSQL_USER=root npm run test:integration` (สร้าง/ลบฐานทดสอบเอง)
- [ ] `node scripts/move-legacy-uploads.mjs` (ดูรายการ) → `--apply` → เปิดหน้าครุภัณฑ์ที่มีรูปว่ายังแสดง → ลบ `public\uploads\assets`
- [ ] ออกจากระบบแล้วเปิด URL รูป `/uploads/assets/...` ต้องได้ 401

## ฟังก์ชัน
- [ ] หน้าหน่วยงาน → พิมพ์สติ๊กเกอร์ A4 / PDF → ลองทุกขนาด, เว้นดวง, บันทึกเป็น PDF (Scale 100%, ขอบ “ไม่มี”) → พิมพ์บนกระดาษธรรมดาแล้วทาบแผ่นสติ๊กเกอร์ → สแกน QR ขนาดจิ๋วด้วย Android และ iPhone (ต้องเปิดหน้าครุภัณฑ์หลังล็อกอิน)
- [ ] รอบตรวจนับ → ติ๊กสแกนต่อเนื่อง → ปิด Wi-Fi/เน็ตมือถือ → สแกน/กดพบ 3–5 รายการ (จำนวนรอส่งเพิ่ม) → เปิดเน็ต → ส่งอัตโนมัติ ตารางอัปเดต, audit log มี “สแกนออฟไลน์”
- [ ] ปิดรอบขณะยังมีรายการรอส่ง → ต้องแจ้งว่าบันทึกไม่ได้และมีปุ่มล้างรายการ
- [ ] รายงาน → แผนทดแทน ตัวเลขสมเหตุสมผล และดาวน์โหลด Excel เปิดได้
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" "<url>/api/cron/daily-summary?dry=1"` ได้ JSON; ไม่มี token ได้ 401

## บน Docker server
- [ ] `docker compose --env-file .env.docker config -q` ไม่มี error → `up -d --build` → `ps` ทุก service ทำงาน, app healthy
- [ ] `docker compose exec backup bash /backup.sh now` ได้ไฟล์ใน `./backups` ทั้ง db และ uploads · ทดลองกู้บนเครื่องทดสอบ
- [ ] ตั้ง `AGENT_API_BASE_URL` บน Vercel → Agent 1.1 ย้ายเอง · เครื่องรุ่นเก่ารัน repoint → ตรวจหน้า Agent ว่าออนไลน์ครบก่อนปิด Vercel
