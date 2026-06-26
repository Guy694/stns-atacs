-- Migration: enforce two asset categories (Hardware / Software)
-- Safe to run multiple times.

SET @has_asset_category_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'information_assets'
    AND COLUMN_NAME = 'asset_category'
);

SET @asset_category_column_sql := IF(
  @has_asset_category_column = 0,
  "ALTER TABLE `information_assets` ADD COLUMN `asset_category` ENUM('Hardware','Software') NOT NULL DEFAULT 'Hardware' COMMENT 'Primary asset category (Hardware/Software)' AFTER `owner_name`",
  'SELECT 1'
);

PREPARE stmt_add_asset_category_column FROM @asset_category_column_sql;
EXECUTE stmt_add_asset_category_column;
DEALLOCATE PREPARE stmt_add_asset_category_column;

UPDATE `information_assets`
SET `asset_category` = CASE
  WHEN LOWER(TRIM(COALESCE(`asset_group`, ''))) IN (
    'software',
    'system',
    'application',
    'app',
    'os',
    'windows',
    'linux'
  ) THEN 'Software'
  ELSE 'Hardware'
END;

SET @has_asset_category_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'information_assets'
    AND INDEX_NAME = 'idx_information_assets_asset_category'
);

SET @asset_category_index_sql := IF(
  @has_asset_category_index = 0,
  'CREATE INDEX `idx_information_assets_asset_category` ON `information_assets` (`asset_category`)',
  'SELECT 1'
);

PREPARE stmt_add_asset_category_index FROM @asset_category_index_sql;
EXECUTE stmt_add_asset_category_index;
DEALLOCATE PREPARE stmt_add_asset_category_index;