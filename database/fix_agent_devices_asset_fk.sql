-- Fix for:
-- Failed to add the foreign key constraint. Missing index for constraint
-- 'fk_agent_devices_asset' in the referenced table 'information_assets'
--
-- Run this on the target database, then rerun database/agent_inventory.sql
-- if agent_devices was not created yet.

SET @information_assets_id_index_count := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'information_assets'
    AND COLUMN_NAME = 'id'
    AND SEQ_IN_INDEX = 1
);
SET @ensure_information_assets_id_index := IF(
  @information_assets_id_index_count = 0,
  'ALTER TABLE `information_assets` ADD INDEX `idx_information_assets_id` (`id`)',
  'SELECT ''information_assets.id already indexed'' AS migration_note'
);
PREPARE ensure_information_assets_id_index_stmt FROM @ensure_information_assets_id_index;
EXECUTE ensure_information_assets_id_index_stmt;
DEALLOCATE PREPARE ensure_information_assets_id_index_stmt;

SET @agent_devices_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
);
SET @fk_agent_devices_asset_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND CONSTRAINT_NAME = 'fk_agent_devices_asset'
);
SET @ensure_agent_devices_asset_fk := IF(
  @agent_devices_exists > 0 AND @fk_agent_devices_asset_exists = 0,
  'ALTER TABLE `agent_devices` ADD CONSTRAINT `fk_agent_devices_asset` FOREIGN KEY (`linked_asset_id`) REFERENCES `information_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT ''agent_devices missing or fk_agent_devices_asset already exists'' AS migration_note'
);
PREPARE ensure_agent_devices_asset_fk_stmt FROM @ensure_agent_devices_asset_fk;
EXECUTE ensure_agent_devices_asset_fk_stmt;
DEALLOCATE PREPARE ensure_agent_devices_asset_fk_stmt;
