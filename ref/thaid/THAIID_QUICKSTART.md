# 🚀 Quick Start Guide - ThaiID Login

## เริ่มต้นใช้งาน ThaiID Login ใน 5 นาที

### ขั้นตอนที่ 1: อัพเดต Database (1 นาที)

```bash
# เข้า MySQL
mysql -u root -p stneoc

# รันคำสั่ง SQL
source alter_officer_thaiid.sql;

# ตรวจสอบว่าคอลัมน์ถูกสร้างแล้ว
DESCRIBE officer;
```

คุณจะเห็นคอลัมน์ใหม่:
- `pid` VARCHAR(13)
- `thaiid_token` TEXT
- `last_login` DATETIME

---

### ขั้นตอนที่ 2: ใส่เลขบัตรประชาชน (2 นาที)

```sql
-- แก้ไขเป็นเลขบัตรประชาชนจริงของคุณ
UPDATE officer 
SET pid = 'xxxxxxxxxxxxxxx' 
WHERE username = 'your_username';

-- ตรวจสอบ
SELECT username, full_name, pid FROM officer WHERE pid IS NOT NULL;
```

**⚠️ สำคัญ:** ต้องใช้เลขบัตรประชาชน **13 หลัก** ที่ลงทะเบียนกับ ThaiID แล้ว

---

### ขั้นตอนที่ 3: ตรวจสอบ Environment Variables (30 วินาที)

เปิดไฟล์ `.env.local` และตรวจสอบว่ามีค่าเหล่านี้:

```env
CALLBACK=https://stn-eoc.vercel.app/
APIKEY=your_thaiid_api_key
CLIENT_ID=your_thaiid_client_id
CLIENT_SECRET=your_thaiid_client_secret
```

**สำหรับ Development (localhost):**
```env
CALLBACK=http://localhost:3000/
```

---

### ขั้นตอนที่ 4: รัน Server (30 วินาที)

```bash
npm run dev
```

เปิดเบราว์เซอร์: http://localhost:3000/login

---

### ขั้นตอนที่ 5: ทดสอบ Login (1 นาที)

1. คลิกปุ่ม **"เข้าสู่ระบบด้วย ThaiID"** (สีน้ำเงิน)
2. จะถูก redirect ไป ThaiID Login Page
3. กรอกเลขบัตรประชาชนและ OTP
4. อนุมัติการเข้าถึงข้อมูล
5. **สำเร็จ!** คุณจะกลับมาที่ Dashboard

---

## 🎯 การทดสอบที่แนะนำ

### ทดสอบ 1: ตรวจสอบว่า API endpoints ทำงาน

```bash
# ทดสอบ authorize endpoint (จะ redirect ไป ThaiID)
curl -I http://localhost:3000/api/auth/thaiid/authorize

# คาดหวัง: HTTP 307 (Redirect)
```

### ทดสอบ 2: ตรวจสอบ Database

```sql
-- ดูว่ามีผู้ใช้ที่มี PID หรือยัง
SELECT COUNT(*) as users_with_pid 
FROM officer 
WHERE pid IS NOT NULL;

-- ควรเห็นจำนวนมากกว่า 0
```

### ทดสอบ 3: ดู Activity Logs

```sql
-- หลังจาก login สำเร็จ ตรวจสอบ log
SELECT * FROM activity_logs 
WHERE action = 'LOGIN_THAIID' 
ORDER BY timestamp DESC 
LIMIT 5;
```

---

## ❌ ปัญหาที่พบบ่อยและวิธีแก้

### ปัญหา 1: "user_not_found"

```
ข้อความ: ไม่พบผู้ใช้งานที่มีเลขบัตรประชาชน: xxxxx
```

**แก้ไข:**
```sql
-- ตรวจสอบว่าใส่ PID ถูกต้องหรือยัง
SELECT * FROM officer WHERE pid = 'xxxxx';

-- ถ้าไม่มี ให้เพิ่ม
UPDATE officer SET pid = 'xxxxx' WHERE username = 'your_username';
```

---

### ปัญหา 2: "Redirect URI mismatch"

```
ข้อความ: The redirect URI provided does not match
```

**แก้ไข:**
1. ตรวจสอบ `.env.local`:
   ```env
   CALLBACK=http://localhost:3000/  # ต้องมี / ท้ายสุด
   ```

2. Redirect URI ที่ถูกต้อง:
   ```
   Development: http://localhost:3000/api/auth/thaiid/callback
   Production: https://stn-eoc.vercel.app/api/auth/thaiid/callback
   ```

---

### ปัญหา 3: "Token exchange failed"

```
ข้อความ: Token exchange failed: 401
```

**แก้ไข:**
1. ตรวจสอบ APIKEY ใน `.env.local`
2. ตรวจสอบ CLIENT_ID และ CLIENT_SECRET
3. ตรวจสอบว่า credentials ไม่หมดอายุ

---

### ปัญหา 4: คอลัมน์ pid ไม่มี

```
Error: Unknown column 'pid' in 'where clause'
```

**แก้ไข:**
```bash
# รัน SQL อีกครั้ง
mysql -u root -p stneoc < alter_officer_thaiid.sql

# ตรวจสอบ
mysql -u root -p stneoc -e "DESCRIBE officer;"
```

---

## 📊 Dashboard สำหรับ Admin

### ดูสถิติการใช้งาน ThaiID

```sql
-- จำนวนผู้ใช้ที่ลงทะเบียน ThaiID
SELECT 
    COUNT(*) as total_users,
    COUNT(pid) as registered_thaiid,
    COUNT(last_login) as ever_logged_in
FROM officer;

-- ผู้ใช้ที่ login ล่าสุดด้วย ThaiID
SELECT 
    username,
    full_name,
    role,
    last_login
FROM officer
WHERE last_login IS NOT NULL
ORDER BY last_login DESC
LIMIT 10;

-- Activity logs ของ ThaiID
SELECT 
    DATE(timestamp) as login_date,
    COUNT(*) as login_count
FROM activity_logs
WHERE action = 'LOGIN_THAIID'
GROUP BY DATE(timestamp)
ORDER BY login_date DESC
LIMIT 7;
```

---

## 🔐 Security Checklist

- [ ] ตั้งค่า HTTPS สำหรับ production
- [ ] เก็บ CLIENT_SECRET ใน environment variables เท่านั้น
- [ ] ตั้งค่า cookie `secure` flag เป็น true ใน production
- [ ] ตรวจสอบ state parameter ใน callback
- [ ] จำกัด IP address ที่เข้าถึง database ได้
- [ ] ตั้งค่า rate limiting สำหรับ API endpoints
- [ ] Backup database ก่อนทำการ migration
- [ ] ทดสอบใน development ก่อน deploy

---

## 🎉 เสร็จสิ้น!

หลังจากทำตามขั้นตอนข้างต้นแล้ว คุณจะมี:

✅ ระบบ Login ด้วย ThaiID ที่ทำงานได้เต็มรูปแบบ
✅ รองรับทั้ง Login แบบปกติและ ThaiID
✅ บันทึก Activity Logs ทุกครั้งที่ login
✅ ความปลอดภัยระดับสูงด้วย OAuth 2.0
✅ UI ที่สวยงามและใช้งานง่าย

---

## 📞 ต้องการความช่วยเหลือ?

1. อ่านเอกสารฉบับเต็ม: [THAIID_LOGIN_README.md](./THAIID_LOGIN_README.md)
2. ดูคู่มือ DOPA: https://docs.bora.dopa.go.th/
3. ตรวจสอบ console logs สำหรับ debug

**Happy Coding! 🚀**
