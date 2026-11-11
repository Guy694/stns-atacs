-- SEC2: ประวัติการเข้าสู่ระบบและเซสชันที่ใช้งานอยู่ (IP, อุปกรณ์, ช่องทาง, ใช้งานล่าสุด)
-- รันซ้ำได้ (ตรวจคอลัมน์ก่อนเพิ่ม) · เซสชันที่มีอยู่ก่อนรันจะแสดงเป็น "ไม่ทราบ"

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE auth_sessions
     ADD COLUMN ip_address VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER expires_at,
     ADD COLUMN user_agent VARCHAR(300) NULL AFTER ip_address,
     ADD COLUMN login_method VARCHAR(20) NULL AFTER user_agent,
     ADD COLUMN last_seen_at DATETIME NULL AFTER login_method,
     ADD COLUMN last_ip VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER last_seen_at',
  'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_sessions' AND COLUMN_NAME = 'ip_address');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
