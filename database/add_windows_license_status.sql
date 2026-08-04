-- บันทึกสถานะลิขสิทธิ์ Windows สำหรับทรัพย์สินประเภทคอมพิวเตอร์
ALTER TABLE `information_assets`
  ADD COLUMN `windows_license_status` ENUM('Genuine','Pirated') DEFAULT NULL
  COMMENT 'สถานะลิขสิทธิ์ Windows: Genuine=แท้, Pirated=เถื่อน'
  AFTER `operating_system_version`;

