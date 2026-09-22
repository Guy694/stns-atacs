-- ตรวจนับ: บันทึกกลุ่มงาน/ที่ตั้งที่พบครุภัณฑ์จริง เทียบกับกลุ่มงานในทะเบียน (กรณีย้ายสถานที่)
-- Prerequisites: inspection_audit.sql, add_inspection_workflow.sql. Additive and repeatable: nullable columns only.
-- Existing results keep NULL (= not recorded). Take a backup before running.

SET @has_found_1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspection_items' AND COLUMN_NAME = 'found_work_group_id');
SET @sql_found_1 := IF(@has_found_1 = 0, 'ALTER TABLE `asset_inspection_items` ADD COLUMN `found_work_group_id` INT NULL COMMENT ''กลุ่มงานที่พบครุภัณฑ์จริงตอนตรวจนับ (อาจต่างจากทะเบียน)'' AFTER `asset_status`', 'SELECT ''asset_inspection_items.found_work_group_id already exists'' AS migration_note');
PREPARE stmt_found_1 FROM @sql_found_1;
EXECUTE stmt_found_1;
DEALLOCATE PREPARE stmt_found_1;

SET @has_found_2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspection_items' AND COLUMN_NAME = 'found_location');
SET @sql_found_2 := IF(@has_found_2 = 0, 'ALTER TABLE `asset_inspection_items` ADD COLUMN `found_location` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''ที่ตั้งที่พบจริง (ถ้าต่างจากทะเบียน)'' AFTER `found_work_group_id`', 'SELECT ''asset_inspection_items.found_location already exists'' AS migration_note');
PREPARE stmt_found_2 FROM @sql_found_2;
EXECUTE stmt_found_2;
DEALLOCATE PREPARE stmt_found_2;

SET @has_found_3 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspection_items' AND COLUMN_NAME = 'registered_work_group_id');
SET @sql_found_3 := IF(@has_found_3 = 0, 'ALTER TABLE `asset_inspection_items` ADD COLUMN `registered_work_group_id` INT NULL COMMENT ''กลุ่มงานในทะเบียน ณ เวลาที่ตรวจ'' AFTER `found_location`', 'SELECT ''asset_inspection_items.registered_work_group_id already exists'' AS migration_note');
PREPARE stmt_found_3 FROM @sql_found_3;
EXECUTE stmt_found_3;
DEALLOCATE PREPARE stmt_found_3;
