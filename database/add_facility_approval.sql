-- Migration: เพิ่ม facility_id ให้ users และเปิดใช้ pending approval workflow
-- รันหลังจาก auth.sql และ add_password_auth.sql แล้วเท่านั้น

-- 1) เพิ่ม facility_id (nullable) สำหรับผูก officer กับหน่วยงาน
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `facility_id` INT NULL DEFAULT NULL
    COMMENT 'หน่วยงานที่สังกัด — ใช้สำหรับ officer / pending user'
    AFTER `role`;

-- 2) index เพื่อ query ตาม facility
ALTER TABLE `users`
  ADD INDEX IF NOT EXISTS `idx_users_facility_id` (`facility_id`);

-- 3) foreign key ไปยัง health_facilities
--    ถ้ารันซ้ำให้ drop ก่อน หรือตรวจสอบด้วย SHOW CREATE TABLE users;
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_facility`
    FOREIGN KEY (`facility_id`) REFERENCES `health_facilities` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
