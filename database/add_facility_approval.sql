-- Migration: เพิ่ม facility_id ให้ users และเปิดใช้ pending approval workflow
-- รันหลังจาก auth.sql และ add_password_auth.sql แล้วเท่านั้น
-- หมายเหตุ: รันได้ครั้งเดียว — ถ้ารันซ้ำให้ลบ constraint/index เก่าก่อน

-- 1) เพิ่ม facility_id (nullable) สำหรับผูก officer กับหน่วยงาน
ALTER TABLE `users`
  ADD COLUMN `facility_id` INT NULL DEFAULT NULL
    COMMENT 'หน่วยงานที่สังกัด — ใช้สำหรับ officer / pending user'
    AFTER `role`;

-- 2) index เพื่อ query ตาม facility
ALTER TABLE `users`
  ADD INDEX `idx_users_facility_id` (`facility_id`);

-- 3) foreign key ไปยัง health_facilities
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_facility`
    FOREIGN KEY (`facility_id`) REFERENCES `health_facilities` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
