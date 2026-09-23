-- Migration (additive, ปลอดภัยต่อการรันซ้ำ): ควบคุมการเชื่อมบัญชีเดิมกับ ThaiD
--
-- SEC-04: เดิมระบบผูกบัญชีเดิมเข้ากับ ThaiD โดยดูแค่ชื่อ-นามสกุลตรงกันเพียงบัญชีเดียว
-- ทำให้คนที่ชื่อซ้ำกับผู้ใช้ (รวมถึงแอดมิน) ยึดบัญชีได้
--
-- หลังรัน migration นี้:
--   * บัญชีจะผูก ThaiD อัตโนมัติได้ ก็ต่อเมื่อผู้ดูแลระบบเปิด `thaid_link_enabled = 1` ให้ก่อน
--   * หรือผู้ดูแลระบบบันทึกค่า hash ของเลขบัตรที่อนุญาตไว้ใน `thaid_link_expected_hash`
--   * บัญชีบทบาท admin ห้ามผูกอัตโนมัติในทุกกรณี (บังคับในโค้ด)

SET @has_link_enabled := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'thaid_link_enabled'
);
SET @sql_link_enabled := IF(
  @has_link_enabled = 0,
  "ALTER TABLE users ADD COLUMN thaid_link_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ผู้ดูแลระบบอนุญาตให้บัญชีนี้ผูก ThaiD ครั้งแรกด้วยชื่อ-นามสกุล (0 = ไม่อนุญาต)'",
  'SELECT 1'
);
PREPARE stmt_link_enabled FROM @sql_link_enabled;
EXECUTE stmt_link_enabled;
DEALLOCATE PREPARE stmt_link_enabled;

SET @has_expected_hash := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'thaid_link_expected_hash'
);
SET @sql_expected_hash := IF(
  @has_expected_hash = 0,
  "ALTER TABLE users ADD COLUMN thaid_link_expected_hash CHAR(64) NULL COMMENT 'HMAC-SHA256 ของเลขบัตรที่ผู้ดูแลระบบบันทึกไว้ล่วงหน้าสำหรับบัญชีนี้'",
  'SELECT 1'
);
PREPARE stmt_expected_hash FROM @sql_expected_hash;
EXECUTE stmt_expected_hash;
DEALLOCATE PREPARE stmt_expected_hash;
