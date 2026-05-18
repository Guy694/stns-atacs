# คู่มือการติดตั้งและใช้งาน ThaiID Login System

## 📋 สารบัญ
1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [การติดตั้ง](#การติดตั้ง)
3. [การกำหนดค่า](#การกำหนดค่า)
4. [วิธีการใช้งาน](#วิธีการใช้งาน)
5. [โครงสร้างไฟล์](#โครงสร้างไฟล์)
6. [API Endpoints](#api-endpoints)
7. [การทดสอบ](#การทดสอบ)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 ภาพรวมระบบ

ระบบ ThaiID Login เป็นระบบยืนยันตัวตนผ่าน **DOPA ThaiID** โดยใช้ OAuth 2.0 Authorization Code Flow ที่ช่วยให้ผู้ใช้สามารถเข้าสู่ระบบด้วยเลขบัตรประชาชนผ่าน ThaiID ได้อย่างปลอดภัย

### คุณสมบัติหลัก
- ✅ รองรับการ Login ด้วย ThaiID (OAuth 2.0)
- ✅ ยืนยันตัวตนด้วยเลขบัตรประชาชน (PID)
- ✅ เชื่อมต่อกับ DOPA Production Server
- ✅ บันทึก Activity Log ทุกครั้งที่มีการ Login
- ✅ รองรับการ Login แบบปกติ (Username/Password) คู่ขนานไป

---

## 🚀 การติดตั้ง

### 1. อัพเดต Database Schema

รันไฟล์ SQL เพื่อเพิ่มคอลัมน์สำหรับเก็บข้อมูล ThaiID:

```bash
mysql -u root -p stneoc < alter_officer_thaiid.sql
```

ไฟล์นี้จะเพิ่มคอลัมน์ดังนี้:
- `pid` - เลขบัตรประชาชน 13 หลัก (UNIQUE)
- `thaiid_token` - ThaiID Access Token
- `last_login` - วันที่เข้าสู่ระบบล่าสุด

### 2. กำหนดค่า Environment Variables

ตรวจสอบไฟล์ `.env.local` ให้มีค่าดังนี้:

```env
# ThaiID Configuration (DOPA)
CALLBACK=https://stn-eoc.vercel.app/
APIKEY=your_thaiid_api_key
CLIENT_ID=your_thaiid_client_id
CLIENT_SECRET=your_thaiid_client_secret
```

**หมายเหตุ:** 
- `CALLBACK` ต้องเป็น URL ที่ลงทะเบียนกับ DOPA แล้ว
- สำหรับ localhost: `http://localhost:3000/`
- สำหรับ production: `https://your-domain.com/`

### 3. อัพเดตข้อมูล PID สำหรับผู้ใช้

ต้องกำหนดเลขบัตรประชาชนให้กับผู้ใช้ในระบบ:

```sql
-- ตัวอย่างการอัพเดต PID
UPDATE officer SET pid = '1234567890123' WHERE username = 'admin';
UPDATE officer SET pid = '1234567890124' WHERE username = 'mcatt01';
UPDATE officer SET pid = '1234567890125' WHERE username = 'sat01';
```

**⚠️ สำคัญ:** ต้องใช้เลขบัตรประชาชนจริงที่ลงทะเบียนกับ ThaiID

---

## ⚙️ การกำหนดค่า

### ThaiID URLs (Production)
```javascript
Authorization URL: https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/
Token URL: https://imauth.bora.dopa.go.th/api/v2/oauth2/token/
UserInfo URL: https://imauth.bora.dopa.go.th/api/v2/oauth2/userinfo/
```

### OAuth 2.0 Parameters
- **Grant Type:** authorization_code
- **Response Type:** code
- **Scope:** pid (เลขบัตรประชาชน)
- **Redirect URI:** `{CALLBACK}/api/auth/thaiid/callback`

---

## 📖 วิธีการใช้งาน

### สำหรับผู้ใช้งาน

1. เข้าหน้า Login: `/login`
2. คลิกปุ่ม **"เข้าสู่ระบบด้วย ThaiID"** (สีน้ำเงิน)
3. ระบบจะพาไปหน้า ThaiID Login
4. ยืนยันตัวตนด้วย ThaiID (เลขบัตรประชาชน + OTP)
5. อนุมัติการเข้าถึงข้อมูล
6. ระบบจะ redirect กลับมาที่หน้า callback
7. เข้าสู่ระบบสำเร็จ → ไปที่ Dashboard

### สำหรับ Admin

#### เพิ่มผู้ใช้ใหม่ที่รองรับ ThaiID:

```sql
INSERT INTO officer (username, password_hash, full_name, email, role, pid)
VALUES (
    'newuser',
    '$2a$10$xxxxx', -- hashed password
    'นายทดสอบ ระบบ',
    'test@example.com',
    'staff',
    '1234567890123' -- เลขบัตรประชาชน 13 หลัก
);
```

---

## 📁 โครงสร้างไฟล์

```
stn-eoc/
├── app/
│   ├── login/
│   │   └── page.js                          # หน้า Login (มีปุ่ม ThaiID)
│   ├── auth/
│   │   └── thaiid/
│   │       └── callback/
│   │           └── page.js                  # หน้าแสดงสถานะ Login
│   └── api/
│       └── auth/
│           ├── session/
│           │   └── route.js                 # API ดึงข้อมูล session
│           └── thaiid/
│               ├── authorize/
│               │   └── route.js             # เริ่มต้น OAuth flow
│               └── callback/
│                   └── route.js             # รับ code และแลก token
├── .env.local                                # Environment variables
└── alter_officer_thaiid.sql                 # SQL สำหรับอัพเดต schema
```

---

## 🔌 API Endpoints

### 1. เริ่มต้น OAuth Flow
```
GET /api/auth/thaiid/authorize
```
**การทำงาน:**
1. สร้าง state สุ่มเพื่อป้องกัน CSRF
2. สร้าง Authorization URL
3. Redirect ไป ThaiID Login Page

### 2. OAuth Callback
```
GET /api/auth/thaiid/callback?code={code}&state={state}
```
**Parameters:**
- `code` - Authorization code จาก ThaiID
- `state` - State สำหรับตรวจสอบ CSRF

**การทำงาน:**
1. แลก authorization code เป็น access token
2. ใช้ access token เรียก UserInfo API เพื่อได้ PID
3. ค้นหาผู้ใช้ในฐานข้อมูลจาก PID
4. สร้าง session และเก็บใน cookie
5. บันทึก activity log
6. Redirect ไปหน้า callback

### 3. ดึงข้อมูล Session
```
GET /api/auth/session
```
**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "ผู้ดูแลระบบ",
    "role": "admin",
    "pid": "1234567890123",
    "loginMethod": "thaiid"
  }
}
```

---

## 🧪 การทดสอบ

### ทดสอบใน Development

1. **ตั้งค่า CALLBACK เป็น localhost:**
```env
CALLBACK=http://localhost:3000/
```

2. **ลงทะเบียน Redirect URI กับ DOPA:**
```
http://localhost:3000/api/auth/thaiid/callback
```

3. **รันเซิร์ฟเวอร์:**
```bash
npm run dev
```

4. **ทดสอบการ Login:**
   - เข้า: http://localhost:3000/login
   - คลิก "เข้าสู่ระบบด้วย ThaiID"
   - ใช้ ThaiID ที่มี PID ตรงกับในฐานข้อมูล

### ตรวจสอบ Logs

ดู console logs เพื่อ debug:
```javascript
console.log('ThaiID Callback - Code received:', code);
console.log('ThaiID - Access Token received');
console.log('ThaiID - User PID:', pid);
```

---

## 🔧 Troubleshooting

### ปัญหาที่พบบ่อย

#### 1. Error: "user_not_found"
**สาเหตุ:** ไม่พบ PID ในฐานข้อมูล
**แก้ไข:**
```sql
-- ตรวจสอบว่า PID ถูกบันทึกหรือยัง
SELECT * FROM officer WHERE pid = '1234567890123';

-- ถ้าไม่มี ให้เพิ่ม PID
UPDATE officer SET pid = '1234567890123' WHERE username = 'admin';
```

#### 2. Error: "Token exchange failed"
**สาเหตุ:** CLIENT_ID, CLIENT_SECRET, หรือ APIKEY ไม่ถูกต้อง
**แก้ไข:** ตรวจสอบค่าใน `.env.local` ให้ตรงกับที่ DOPA ให้มา

#### 3. Error: "Redirect URI mismatch"
**สาเหตุ:** URL ที่ตั้งใน `.env.local` ไม่ตรงกับที่ลงทะเบียนกับ DOPA
**แก้ไข:**
```env
# ตรวจสอบว่า CALLBACK ตรงกับที่ลงทะเบียนหรือไม่
CALLBACK=https://your-actual-domain.com/
```

#### 4. Error: "no_code"
**สาเหตุ:** ผู้ใช้ยกเลิกการให้สิทธิ์ หรือมีปัญหาใน authorization flow
**แก้ไข:** ลองใหม่อีกครั้ง หรือตรวจสอบ state parameter

### ตรวจสอบการตั้งค่า Database

```sql
-- ตรวจสอบโครงสร้างตาราง
DESCRIBE officer;

-- ตรวจสอบผู้ใช้ที่มี PID
SELECT id, username, full_name, pid, last_login 
FROM officer 
WHERE pid IS NOT NULL;
```

### ทดสอบ API Endpoints

```bash
# ทดสอบ authorize endpoint
curl http://localhost:3000/api/auth/thaiid/authorize

# ทดสอบ session endpoint
curl http://localhost:3000/api/auth/session
```

---

## 🔒 ความปลอดภัย

### มาตรการรักษาความปลอดภัย:

1. **CSRF Protection:** ใช้ `state` parameter แบบสุ่ม
2. **Secure Cookies:** ใช้ `httpOnly` และ `secure` flags
3. **Token Storage:** เก็บ access token ใน database (ไม่แสดงให้ client)
4. **Activity Logging:** บันทึกทุกการ login ด้วย ThaiID
5. **HTTPS Only:** ใช้ HTTPS ใน production เท่านั้น

### Best Practices:

- ไม่ส่ง `CLIENT_SECRET` และ `APIKEY` ไปที่ client-side
- เก็บ credentials ใน environment variables
- ตรวจสอบ `state` parameter ทุกครั้งใน callback
- ใช้ HTTPS สำหรับ production
- ตั้งค่า cookie expiration อย่างเหมาะสม

---

## 📞 การติดต่อและสนับสนุน

หากพบปัญหาหรือต้องการความช่วยเหลือ:

1. ตรวจสอบ console logs และ error messages
2. อ่าน [คู่มือ DOPA ThaiID API](https://docs.bora.dopa.go.th/)
3. ติดต่อทีม DOPA Support สำหรับปัญหาด้าน ThaiID

---

## 📝 Change Log

### Version 1.0.0 (2025-01-25)
- ✅ เพิ่มระบบ Login ด้วย ThaiID
- ✅ รองรับ OAuth 2.0 Authorization Code Flow
- ✅ เชื่อมต่อกับ DOPA Production Server
- ✅ เพิ่มการบันทึก Activity Log
- ✅ เพิ่มหน้า Callback สำหรับแสดงสถานะ
- ✅ อัพเดต Database Schema รองรับ ThaiID

---

## 📄 License

Copyright © 2025 EOC จังหวัดสตูล - All Rights Reserved
