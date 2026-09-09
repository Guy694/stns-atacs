-- migration: เพิ่มกลุ่มครุภัณฑ์กลางเพื่อรองรับพัสดุรวมนอกเหนือจาก IT ในอนาคต
-- ค่าเริ่มต้น IT ทำให้ข้อมูลทรัพย์สินสารสนเทศเดิมใช้งานต่อได้ทันที

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND COLUMN_NAME = 'asset_class'
  ),
  'ALTER TABLE `information_assets` ADD COLUMN `asset_class` VARCHAR(60) NOT NULL DEFAULT ''IT'' COMMENT ''กลุ่มครุภัณฑ์รวม เช่น IT, Office, Medical, Vehicle'' AFTER `owner_name`',
  'SELECT ''asset_class already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `information_assets`
SET `asset_class` = 'IT'
WHERE `asset_class` IS NULL OR TRIM(`asset_class`) = '';

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'information_assets'
      AND INDEX_NAME = 'idx_information_assets_asset_class'
  ),
  'CREATE INDEX `idx_information_assets_asset_class` ON `information_assets` (`asset_class`)',
  'SELECT ''idx_information_assets_asset_class already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
