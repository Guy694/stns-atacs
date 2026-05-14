-- ตารางประเภทอุปกรณ์สารสนเทศ สำหรับ dropdown ในหน้าบันทึกทรัพย์สิน
CREATE TABLE IF NOT EXISTS `asset_device_types` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100)  NOT NULL COMMENT 'ชื่อประเภท เช่น Server, Firewall, Switch',
  `category`     ENUM('Hardware','Software') NOT NULL DEFAULT 'Hardware',
  `is_active`    TINYINT(1)    NOT NULL DEFAULT 1,
  `sort_order`   INT           NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asset_device_types_name_category` (`name`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ประเภทอุปกรณ์/ซอฟต์แวร์สารสนเทศ';

-- ข้อมูลเริ่มต้น
INSERT IGNORE INTO `asset_device_types` (`name`, `category`, `sort_order`) VALUES
  ('Server',          'Hardware', 10),
  ('PC / Workstation','Hardware', 20),
  ('Notebook',        'Hardware', 30),
  ('Tablet',          'Hardware', 40),
  ('Printer',         'Hardware', 50),
  ('Scanner',         'Hardware', 60),
  ('Firewall',        'Hardware', 70),
  ('Switch',          'Hardware', 80),
  ('Router',          'Hardware', 90),
  ('Access Point',    'Hardware', 100),
  ('NAS / Storage',   'Hardware', 110),
  ('UPS',             'Hardware', 120),
  ('Projector',       'Hardware', 130),
  ('IP Camera',       'Hardware', 140),
  ('อื่นๆ (Hardware)', 'Hardware', 999),
  ('HIS',             'Software', 10),
  ('ERP',             'Software', 20),
  ('OS License',      'Software', 30),
  ('Antivirus',       'Software', 40),
  ('อื่นๆ (Software)', 'Software', 999);
