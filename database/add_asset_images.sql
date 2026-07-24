-- migration: เพิ่มช่องเก็บ path รูปภาพอุปกรณ์ 1-2 ภาพ
-- รันบน: information_assets

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND COLUMN_NAME = 'asset_image_1_url'
  ),
  'ALTER TABLE `information_assets` ADD COLUMN `asset_image_1_url` VARCHAR(500) NULL DEFAULT NULL COMMENT ''รูปภาพอุปกรณ์ภาพที่ 1'' AFTER `serial_number`',
  'SELECT ''asset_image_1_url already exists'' AS migration_note'
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
      AND COLUMN_NAME = 'asset_image_2_url'
  ),
  'ALTER TABLE `information_assets` ADD COLUMN `asset_image_2_url` VARCHAR(500) NULL DEFAULT NULL COMMENT ''รูปภาพอุปกรณ์ภาพที่ 2'' AFTER `asset_image_1_url`',
  'SELECT ''asset_image_2_url already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
