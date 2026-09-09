-- migration: เพิ่ม workflow การตรวจนับแบบเปิดรอบและทยอยตรวจรายครุภัณฑ์

SET @has_start_date := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_inspections'
    AND COLUMN_NAME = 'start_date'
);
SET @add_start_date_sql := IF(
  @has_start_date = 0,
  'ALTER TABLE `asset_inspections` ADD COLUMN `start_date` DATE NULL COMMENT ''วันที่เริ่มตรวจนับ'' AFTER `inspected_at`',
  'SELECT ''start_date already exists'' AS migration_note'
);
PREPARE stmt_add_start_date FROM @add_start_date_sql;
EXECUTE stmt_add_start_date;
DEALLOCATE PREPARE stmt_add_start_date;

SET @has_end_date := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_inspections'
    AND COLUMN_NAME = 'end_date'
);
SET @add_end_date_sql := IF(
  @has_end_date = 0,
  'ALTER TABLE `asset_inspections` ADD COLUMN `end_date` DATE NULL COMMENT ''วันที่สิ้นสุดการตรวจนับ'' AFTER `start_date`',
  'SELECT ''end_date already exists'' AS migration_note'
);
PREPARE stmt_add_end_date FROM @add_end_date_sql;
EXECUTE stmt_add_end_date;
DEALLOCATE PREPARE stmt_add_end_date;

SET @has_inspection_status := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_inspection_items'
    AND COLUMN_NAME = 'inspection_status'
);
SET @add_inspection_status_sql := IF(
  @has_inspection_status = 0,
  'ALTER TABLE `asset_inspection_items` ADD COLUMN `inspection_status` VARCHAR(30) NOT NULL DEFAULT ''Pending'' COMMENT ''Pending, Found, Missing'' AFTER `found`',
  'SELECT ''inspection_status already exists'' AS migration_note'
);
PREPARE stmt_add_inspection_status FROM @add_inspection_status_sql;
EXECUTE stmt_add_inspection_status;
DEALLOCATE PREPARE stmt_add_inspection_status;

SET @has_asset_status := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_inspection_items'
    AND COLUMN_NAME = 'asset_status'
);
SET @add_asset_status_sql := IF(
  @has_asset_status = 0,
  'ALTER TABLE `asset_inspection_items` ADD COLUMN `asset_status` VARCHAR(100) NULL COMMENT ''สถานะครุภัณฑ์ที่บันทึกตอนตรวจ'' AFTER `inspection_status`',
  'SELECT ''asset_status already exists'' AS migration_note'
);
PREPARE stmt_add_asset_status FROM @add_asset_status_sql;
EXECUTE stmt_add_asset_status;
DEALLOCATE PREPARE stmt_add_asset_status;

SET @has_checked_by := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_inspection_items'
    AND COLUMN_NAME = 'checked_by'
);
SET @add_checked_by_sql := IF(
  @has_checked_by = 0,
  'ALTER TABLE `asset_inspection_items` ADD COLUMN `checked_by` VARCHAR(120) NULL COMMENT ''ผู้ตรวจรายการนี้'' AFTER `condition_note`',
  'SELECT ''checked_by already exists'' AS migration_note'
);
PREPARE stmt_add_checked_by FROM @add_checked_by_sql;
EXECUTE stmt_add_checked_by;
DEALLOCATE PREPARE stmt_add_checked_by;

SET @has_checked_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_inspection_items'
    AND COLUMN_NAME = 'checked_at'
);
SET @add_checked_at_sql := IF(
  @has_checked_at = 0,
  'ALTER TABLE `asset_inspection_items` ADD COLUMN `checked_at` DATETIME NULL COMMENT ''เวลาที่ตรวจรายการนี้'' AFTER `checked_by`',
  'SELECT ''checked_at already exists'' AS migration_note'
);
PREPARE stmt_add_checked_at FROM @add_checked_at_sql;
EXECUTE stmt_add_checked_at;
DEALLOCATE PREPARE stmt_add_checked_at;

UPDATE `asset_inspection_items`
SET
  `inspection_status` = CASE WHEN `found` = 1 THEN 'Found' ELSE 'Missing' END,
  `checked_at` = COALESCE(`checked_at`, `created_at`)
WHERE `inspection_status` = 'Pending'
  AND `created_at` IS NOT NULL;

SET @has_item_status_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_inspection_items'
    AND INDEX_NAME = 'idx_asset_inspection_items_status'
);
SET @add_item_status_index_sql := IF(
  @has_item_status_index = 0,
  'CREATE INDEX `idx_asset_inspection_items_status` ON `asset_inspection_items` (`inspection_id`, `inspection_status`)',
  'SELECT ''idx_asset_inspection_items_status already exists'' AS migration_note'
);
PREPARE stmt_add_item_status_index FROM @add_item_status_index_sql;
EXECUTE stmt_add_item_status_index;
DEALLOCATE PREPARE stmt_add_item_status_index;
