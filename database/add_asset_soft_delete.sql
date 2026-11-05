-- migration: ลบทรัพย์สินแบบเก็บประวัติ (soft delete)
-- รันบน: information_assets
-- การลบจากหน้าจอจะไม่ลบแถวออกจากฐานข้อมูลอีกต่อไป แต่บันทึกเวลา/ผู้ลบไว้ เพื่อให้ประวัติยืม ซ่อม โอนย้าย
-- จำหน่าย สถานะ และ audit log ยังอ้างถึงทรัพย์สินเดิมได้ แถวที่ deleted_at ไม่เป็น NULL จะไม่แสดงในรายการ/รายงานใด ๆ
-- เลขทะเบียนของทรัพย์สินที่ถูกลบยังถูกจองไว้ (UNIQUE survey_id + asset_registration_no) จึงนำมาใช้ซ้ำไม่ได้
-- รันซ้ำได้ (ตรวจ information_schema ก่อนเพิ่มทุกครั้ง) — MySQL 8.0 / MariaDB 10.2+

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND COLUMN_NAME = 'deleted_at'
  ),
  'ALTER TABLE `information_assets` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL COMMENT ''เวลาที่ลบ (soft delete) — NULL = ยังอยู่ในทะเบียน''',
  'SELECT ''deleted_at already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND COLUMN_NAME = 'deleted_by_user_id'
  ),
  'ALTER TABLE `information_assets` ADD COLUMN `deleted_by_user_id` INT NULL DEFAULT NULL COMMENT ''ผู้ลบ (users.id)'' AFTER `deleted_at`',
  'SELECT ''deleted_by_user_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND COLUMN_NAME = 'deleted_by'
  ),
  'ALTER TABLE `information_assets` ADD COLUMN `deleted_by` VARCHAR(255) NULL DEFAULT NULL COMMENT ''ชื่อผู้ลบ'' AFTER `deleted_by_user_id`',
  'SELECT ''deleted_by already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND INDEX_NAME = 'idx_information_assets_deleted_at'
  ),
  'ALTER TABLE `information_assets` ADD INDEX `idx_information_assets_deleted_at` (`deleted_at`)',
  'SELECT ''idx_information_assets_deleted_at already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
