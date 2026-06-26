-- Migration: เพิ่มฟิลด์สำหรับ login แบบ username / password
-- รันหลังจาก auth.sql แล้วเท่านั้น

-- 1) ทำให้ thaid_cid เป็น NULL ได้ เพื่อรองรับ user ที่ใช้แค่ username/password
ALTER TABLE `users`
  MODIFY COLUMN `thaid_cid` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL
    COMMENT 'เลขบัตรประชาชนจากการยืนยันตัวตนผ่าน ThaiD (NULL = user ประเภท username/password เท่านั้น)';

-- 2) เพิ่มคอลัมน์ username และ password_hash
ALTER TABLE `users`
  ADD COLUMN `username` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL
    COMMENT 'ชื่อผู้ใช้สำหรับ login แบบ username/password (ไม่บังคับ)'
    AFTER `email`,
  ADD COLUMN `password_hash` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL
    COMMENT 'password hash (scrypt) สำหรับ login แบบ username/password — NULL หมายถึงยังไม่ได้ตั้งรหัสผ่าน'
    AFTER `username`,
  ADD UNIQUE KEY `uk_users_username` (`username`);

-- CHECK: user ต้องมี thaid_cid หรือ username อย่างน้อยหนึ่งอย่าง
ALTER TABLE `users`
  ADD CONSTRAINT `chk_users_identity`
    CHECK (`thaid_cid` IS NOT NULL OR `username` IS NOT NULL);
