-- ATACS Agent: ถอนการติดตั้ง Agent จากระยะไกล (Agent 2.2.0 ขึ้นไป ประกาศความสามารถ "self-uninstall")
-- uninstall_requested_at / uninstall_requested_by : ผู้ดูแลระบบส่วนกลางสั่งถอนการติดตั้งเมื่อไร โดยใคร (NULL = ไม่มีคำสั่ง หรือยกเลิกคำสั่งแล้ว)
-- uninstalled_at                                 : Agent ยืนยันว่าถอนการติดตั้งตัวเองแล้ว (กุญแจของเครื่องถูกยกเลิก ส่งรายงานไม่ได้อีก)
-- เพิ่มคอลัมน์/ดัชนีอย่างเดียว ไม่ลบ/เปลี่ยนชื่อ รันซ้ำได้ (MySQL 8.0)
-- ระหว่างที่ยังไม่รัน: ปุ่ม "ถอนการติดตั้ง" แจ้งให้รันไฟล์นี้ก่อน ส่วน "ลบออกจากระบบ" และการทำงานอื่นใช้ได้ตามปกติ

SET @agent_devices_uninstall_requested_at_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND COLUMN_NAME = 'uninstall_requested_at'
);
SET @add_agent_devices_uninstall_requested_at := IF(
  @agent_devices_uninstall_requested_at_exists = 0,
  'ALTER TABLE `agent_devices` ADD COLUMN `uninstall_requested_at` DATETIME NULL DEFAULT NULL COMMENT ''เวลาที่ผู้ดูแลสั่งถอนการติดตั้ง Agent (NULL = ไม่มีคำสั่ง)''',
  'SELECT ''agent_devices.uninstall_requested_at already exists'' AS migration_note'
);
PREPARE add_agent_devices_uninstall_requested_at_stmt FROM @add_agent_devices_uninstall_requested_at;
EXECUTE add_agent_devices_uninstall_requested_at_stmt;
DEALLOCATE PREPARE add_agent_devices_uninstall_requested_at_stmt;

SET @agent_devices_uninstall_requested_by_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND COLUMN_NAME = 'uninstall_requested_by'
);
SET @add_agent_devices_uninstall_requested_by := IF(
  @agent_devices_uninstall_requested_by_exists = 0,
  'ALTER TABLE `agent_devices` ADD COLUMN `uninstall_requested_by` VARCHAR(255) NULL DEFAULT NULL COMMENT ''ผู้ที่สั่งถอนการติดตั้ง Agent'' AFTER `uninstall_requested_at`',
  'SELECT ''agent_devices.uninstall_requested_by already exists'' AS migration_note'
);
PREPARE add_agent_devices_uninstall_requested_by_stmt FROM @add_agent_devices_uninstall_requested_by;
EXECUTE add_agent_devices_uninstall_requested_by_stmt;
DEALLOCATE PREPARE add_agent_devices_uninstall_requested_by_stmt;

SET @agent_devices_uninstalled_at_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND COLUMN_NAME = 'uninstalled_at'
);
SET @add_agent_devices_uninstalled_at := IF(
  @agent_devices_uninstalled_at_exists = 0,
  'ALTER TABLE `agent_devices` ADD COLUMN `uninstalled_at` DATETIME NULL DEFAULT NULL COMMENT ''เวลาที่ Agent ยืนยันว่าถอนการติดตั้งตัวเองแล้ว'' AFTER `uninstall_requested_by`',
  'SELECT ''agent_devices.uninstalled_at already exists'' AS migration_note'
);
PREPARE add_agent_devices_uninstalled_at_stmt FROM @add_agent_devices_uninstalled_at;
EXECUTE add_agent_devices_uninstalled_at_stmt;
DEALLOCATE PREPARE add_agent_devices_uninstalled_at_stmt;

-- หน้าติดตาม/cron กรองเครื่องที่ถอนการติดตั้งแล้วออก และหน้าตั้งค่าแสดงเครื่องที่รอถอน
SET @agent_devices_uninstall_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND INDEX_NAME = 'idx_agent_devices_uninstall'
);
SET @add_agent_devices_uninstall_index := IF(
  @agent_devices_uninstall_index_exists = 0,
  'ALTER TABLE `agent_devices` ADD INDEX `idx_agent_devices_uninstall` (`uninstalled_at`, `uninstall_requested_at`)',
  'SELECT ''agent_devices.idx_agent_devices_uninstall already exists'' AS migration_note'
);
PREPARE add_agent_devices_uninstall_index_stmt FROM @add_agent_devices_uninstall_index;
EXECUTE add_agent_devices_uninstall_index_stmt;
DEALLOCATE PREPARE add_agent_devices_uninstall_index_stmt;
