-- ATACS Agent 2.x: เก็บข้อมูลสุขภาพเครื่อง (ไดรฟ์รายตัว, RAM, สถานะดิสก์, Activation, แอนตี้ไวรัส, อัปเดต)
-- เพิ่มคอลัมน์อย่างเดียว ไม่ลบ/เปลี่ยนชื่อ รันซ้ำได้
-- สำรองฐานข้อมูลก่อนรัน: mysqldump ... > backup-before-agent-health.sql
-- ระหว่างที่ยังไม่รัน: Agent ส่งข้อมูลได้ตามปกติ เพียงแต่ส่วนสุขภาพเครื่องจะไม่ถูกบันทึก

SET @agent_devices_health_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND COLUMN_NAME = 'health_json'
);
SET @add_agent_devices_health := IF(
  @agent_devices_health_exists = 0,
  'ALTER TABLE `agent_devices` ADD COLUMN `health_json` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''สุขภาพเครื่องล่าสุดจาก Agent 2.x (JSON ที่ตรวจแล้ว)'' AFTER `raw_payload_json`',
  'SELECT ''agent_devices.health_json already exists'' AS migration_note'
);
PREPARE add_agent_devices_health_stmt FROM @add_agent_devices_health;
EXECUTE add_agent_devices_health_stmt;
DEALLOCATE PREPARE add_agent_devices_health_stmt;
