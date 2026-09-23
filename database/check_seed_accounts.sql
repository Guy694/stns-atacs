-- SEC-05: ตรวจว่าฐานข้อมูลจริงยังมีบัญชีจาก database/seed_users.sql หลงเหลืออยู่หรือไม่
-- รันใน phpMyAdmin (อ่านอย่างเดียว ไม่แก้ไขข้อมูล)

SELECT id, username, email, role, is_active, last_login_at,
       CASE WHEN password_hash IS NULL THEN 'ไม่มีรหัสผ่าน' ELSE 'มีรหัสผ่าน' END AS password_state
FROM users
WHERE username IN ('atacs_admin', 'nakharin', 'thanaphon.r')
   OR email LIKE '%@satun.moph.go.th';

-- ถ้าพบบัญชีข้างต้น ให้เลือกทำอย่างใดอย่างหนึ่ง (ตรวจให้แน่ใจก่อนว่าไม่ใช่บัญชีที่ใช้งานจริง)
--   ปิดใช้งาน:  UPDATE users SET is_active = 0 WHERE username = 'atacs_admin';
--   ล้างรหัสผ่าน (บังคับให้ผู้ดูแลตั้งใหม่):  UPDATE users SET password_hash = NULL WHERE username = 'atacs_admin';
-- หมายเหตุ: อย่าปิดบัญชีแอดมินบัญชีสุดท้ายที่ยังใช้งานได้ ให้สร้างแอดมินใหม่ก่อน
