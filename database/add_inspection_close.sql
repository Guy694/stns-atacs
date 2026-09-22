-- ปิดรอบตรวจนับ: เมื่อปิดแล้วบันทึก/แก้ผลตรวจไม่ได้ จนกว่าผู้มีสิทธิ์จะเปิดรอบอีกครั้ง
-- Additive and repeatable. Existing rounds stay Open.
SET @has_roundstatus := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspections' AND COLUMN_NAME = 'round_status');
SET @sql_roundstatus := IF(@has_roundstatus = 0, 'ALTER TABLE `asset_inspections` ADD COLUMN `round_status` VARCHAR(20) NOT NULL DEFAULT ''Open'' COMMENT ''Open=กำลังตรวจ, Closed=ปิดรอบแล้ว'' AFTER `note`', 'SELECT ''asset_inspections.round_status already exists'' AS migration_note');
PREPARE stmt_roundstatus FROM @sql_roundstatus;
EXECUTE stmt_roundstatus;
DEALLOCATE PREPARE stmt_roundstatus;
SET @has_closedat := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspections' AND COLUMN_NAME = 'closed_at');
SET @sql_closedat := IF(@has_closedat = 0, 'ALTER TABLE `asset_inspections` ADD COLUMN `closed_at` DATETIME NULL AFTER `round_status`', 'SELECT ''asset_inspections.closed_at already exists'' AS migration_note');
PREPARE stmt_closedat FROM @sql_closedat;
EXECUTE stmt_closedat;
DEALLOCATE PREPARE stmt_closedat;
SET @has_closedby := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspections' AND COLUMN_NAME = 'closed_by');
SET @sql_closedby := IF(@has_closedby = 0, 'ALTER TABLE `asset_inspections` ADD COLUMN `closed_by` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL AFTER `closed_at`', 'SELECT ''asset_inspections.closed_by already exists'' AS migration_note');
PREPARE stmt_closedby FROM @sql_closedby;
EXECUTE stmt_closedby;
DEALLOCATE PREPARE stmt_closedby;
