-- ตารางประเภทอุปกรณ์สารสนเทศ สำหรับ dropdown ในหน้าบันทึกทรัพย์สิน
CREATE TABLE IF NOT EXISTS `asset_device_types` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100)  NOT NULL COMMENT 'ชื่อประเภท เช่น เครื่องแม่ข่าย, เครื่องพิมพ์, สแกนเนอร์',
  `category`     ENUM('Hardware','Software') NOT NULL DEFAULT 'Hardware',
  `is_active`    TINYINT(1)    NOT NULL DEFAULT 1,
  `sort_order`   INT           NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asset_device_types_name_category` (`name`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='ประเภทอุปกรณ์/ซอฟต์แวร์สารสนเทศ';

-- ปิดรายการ seed ภาษาอังกฤษเดิม เพื่อให้ dropdown ใช้ชื่อภาษาไทยเป็นหลัก
UPDATE `asset_device_types`
SET `is_active` = 0
WHERE `name` IN (
  'Server',
  'PC / Workstation',
  'Notebook',
  'Tablet',
  'Printer',
  'Scanner',
  'Firewall',
  'Switch',
  'Router',
  'Access Point',
  'NAS / Storage',
  'UPS',
  'Projector',
  'IP Camera',
  'อื่นๆ (Hardware)',
  'HIS',
  'ERP',
  'OS License',
  'Antivirus',
  'อื่นๆ (Software)'
);

-- ข้อมูลเริ่มต้นภาษาไทย
INSERT IGNORE INTO `asset_device_types` (`name`, `category`, `sort_order`) VALUES
  ('เครื่องแม่ข่าย',                 'Hardware', 10),
  ('เครื่องคอมพิวเตอร์ตั้งโต๊ะ',      'Hardware', 20),
  ('เครื่องคอมพิวเตอร์ All-in-One',   'Hardware', 25),
  ('เครื่องคอมพิวเตอร์พกพา',          'Hardware', 30),
  ('แท็บเล็ต',                       'Hardware', 40),
  ('เครื่องพิมพ์',                    'Hardware', 50),
  ('เครื่องพิมพ์ฉลาก',                'Hardware', 55),
  ('เครื่องพิมพ์มัลติฟังก์ชัน',        'Hardware', 60),
  ('สแกนเนอร์',                      'Hardware', 70),
  ('เครื่องอ่านบาร์โค้ด',             'Hardware', 80),
  ('ไฟร์วอลล์',                      'Hardware', 90),
  ('สวิตช์เครือข่าย',                 'Hardware', 100),
  ('เราเตอร์',                       'Hardware', 110),
  ('อุปกรณ์กระจายสัญญาณไร้สาย',       'Hardware', 120),
  ('อุปกรณ์จัดเก็บข้อมูลบนเครือข่าย',  'Hardware', 130),
  ('อุปกรณ์สำรองข้อมูล',              'Hardware', 140),
  ('เครื่องสำรองไฟ',                  'Hardware', 150),
  ('ตู้ Rack / อุปกรณ์จัดเก็บในตู้',   'Hardware', 160),
  ('อุปกรณ์ควบคุมห้องประชุม',         'Hardware', 170),
  ('โปรเจกเตอร์',                    'Hardware', 180),
  ('กล้องวงจรปิด IP',                 'Hardware', 190),
  ('โทรศัพท์ IP',                    'Hardware', 200),
  ('อุปกรณ์ IoT ทางการแพทย์',         'Hardware', 210),
  ('อุปกรณ์อื่นๆ',                    'Hardware', 999),
  ('ระบบปฏิบัติการ',                  'Software', 10),
  ('ระบบสารสนเทศโรงพยาบาล',           'Software', 20),
  ('ระบบฐานข้อมูล',                   'Software', 30),
  ('ระบบสำรองข้อมูล',                 'Software', 40),
  ('ระบบป้องกันไวรัส',                'Software', 50),
  ('ระบบบัญชีและการเงิน',             'Software', 60),
  ('ระบบบริหารงานบุคคล',              'Software', 70),
  ('ระบบคลังยา/คลังพัสดุ',            'Software', 80),
  ('ระบบรายงานและ Dashboard',         'Software', 90),
  ('ระบบจัดการสิทธิ์ผู้ใช้',           'Software', 100),
  ('ซอฟต์แวร์ลิขสิทธิ์',              'Software', 110),
  ('ซอฟต์แวร์อื่นๆ',                  'Software', 999);
