-- ATACS Agent: จำการ "ยกเลิกการผูก" ของผู้ดูแล (G7)
-- auto_link_disabled = 1 : ผู้ดูแลยกเลิกการผูกทะเบียนเอง รายงานถัดไปจาก Agent จะไม่ผูกหรือสร้างทะเบียน AGT-xxx ให้อัตโนมัติ
-- ผูกกับทะเบียนใหม่จากหน้า ตั้งค่าระบบ › Agent เมื่อไร ระบบตั้งกลับเป็น 0 เอง
-- เพิ่มคอลัมน์อย่างเดียว ไม่ลบ/เปลี่ยนชื่อ รันซ้ำได้
-- ระหว่างที่ยังไม่รัน: ยกเลิกการผูกได้ตามปกติ แต่ Agent อาจผูกกลับเข้าทะเบียนเดิมในรายงานถัดไป

SET @agent_devices_auto_link_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'agent_devices'
    AND COLUMN_NAME = 'auto_link_disabled'
);
SET @add_agent_devices_auto_link := IF(
  @agent_devices_auto_link_exists = 0,
  'ALTER TABLE `agent_devices` ADD COLUMN `auto_link_disabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = ผู้ดูแลยกเลิกการผูกทะเบียนเอง ห้ามผูก/สร้างทะเบียนอัตโนมัติ'' AFTER `linked_asset_id`',
  'SELECT ''agent_devices.auto_link_disabled already exists'' AS migration_note'
);
PREPARE add_agent_devices_auto_link_stmt FROM @add_agent_devices_auto_link;
EXECUTE add_agent_devices_auto_link_stmt;
DEALLOCATE PREPARE add_agent_devices_auto_link_stmt;
