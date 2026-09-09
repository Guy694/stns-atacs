-- ผูกทรัพย์สินกับกลุ่มงานของหน่วยงานโดยตรง

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND COLUMN_NAME = 'work_group_id'
  ),
  'ALTER TABLE `information_assets` ADD COLUMN `work_group_id` INT NULL DEFAULT NULL COMMENT ''กลุ่มงานเจ้าของทรัพย์สิน'' AFTER `survey_id`',
  'SELECT ''work_group_id already exists'' AS migration_note'
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
      AND INDEX_NAME = 'idx_information_assets_work_group_id'
  ),
  'ALTER TABLE `information_assets` ADD KEY `idx_information_assets_work_group_id` (`work_group_id`)',
  'SELECT ''idx_information_assets_work_group_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND COLUMN_NAME = 'work_group_id'
      AND REFERENCED_TABLE_NAME = 'facility_work_groups'
  ),
  'ALTER TABLE `information_assets` ADD CONSTRAINT `fk_information_assets_work_group` FOREIGN KEY (`work_group_id`) REFERENCES `facility_work_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT ''fk_information_assets_work_group already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
