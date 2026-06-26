-- Add disk free/used metrics reported by ATACS Agent.

SET @agent_devices_disk_free_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND COLUMN_NAME = 'disk_free_gb'
);
SET @add_agent_devices_disk_free := IF(
  @agent_devices_disk_free_exists = 0,
  'ALTER TABLE `agent_devices` ADD COLUMN `disk_free_gb` INT DEFAULT NULL AFTER `disk_total_gb`',
  'SELECT ''agent_devices.disk_free_gb already exists'' AS migration_note'
);
PREPARE add_agent_devices_disk_free_stmt FROM @add_agent_devices_disk_free;
EXECUTE add_agent_devices_disk_free_stmt;
DEALLOCATE PREPARE add_agent_devices_disk_free_stmt;

SET @agent_devices_disk_used_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND COLUMN_NAME = 'disk_used_gb'
);
SET @add_agent_devices_disk_used := IF(
  @agent_devices_disk_used_exists = 0,
  'ALTER TABLE `agent_devices` ADD COLUMN `disk_used_gb` INT DEFAULT NULL AFTER `disk_free_gb`',
  'SELECT ''agent_devices.disk_used_gb already exists'' AS migration_note'
);
PREPARE add_agent_devices_disk_used_stmt FROM @add_agent_devices_disk_used;
EXECUTE add_agent_devices_disk_used_stmt;
DEALLOCATE PREPARE add_agent_devices_disk_used_stmt;
