-- ทะเบียนทรัพย์สินและครุภัณฑ์: ประวัติโอนย้าย, คำขอจำหน่าย/สูญหายแบบอนุมัติ, งานซ่อมบำรุง และอายุการใช้งานเฉพาะรายการ
-- Prerequisites: information_assets (information_assets.sql). Additive and repeatable:
-- no existing table/column is renamed or dropped, no asset row is changed, and IDs/relations stay intact.
-- MySQL DDL auto-commits; application rollback must keep these tables and their data (never DROP them to roll back).

-- 1) Optional per-asset useful-life override (NULL = use the schedule for the asset's class/subtype)
SET @has_useful_life := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'useful_life_years'
);
SET @add_useful_life_sql := IF(@has_useful_life = 0,
  'ALTER TABLE `information_assets` ADD COLUMN `useful_life_years` TINYINT UNSIGNED NULL COMMENT ''อายุการใช้งานสำหรับคิดค่าเสื่อม (ปี) กรณีกำหนดต่างจากตาราง'' AFTER `purchase_order_no`',
  'SELECT ''useful_life_years already exists'' AS migration_note');
PREPARE stmt_useful_life FROM @add_useful_life_sql;
EXECUTE stmt_useful_life;
DEALLOCATE PREPARE stmt_useful_life;

-- 2) Transfer history (one row per transfer; the asset row keeps only the current placement)
CREATE TABLE IF NOT EXISTS `asset_transfers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `from_survey_id` int DEFAULT NULL,
  `to_survey_id` int NOT NULL,
  `from_facility_id` int DEFAULT NULL,
  `to_facility_id` int NOT NULL,
  `from_work_group_id` int DEFAULT NULL,
  `to_work_group_id` int DEFAULT NULL,
  `from_owner_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `to_owner_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `from_location_detail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `to_location_detail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `document_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'เลขที่หนังสือ/ใบโอน',
  `transfer_date` date NOT NULL,
  `transferred_by_user_id` int DEFAULT NULL,
  `transferred_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asset_transfers_asset` (`asset_id`, `transfer_date`),
  KEY `idx_asset_transfers_to_facility` (`to_facility_id`, `transfer_date`),
  KEY `idx_asset_transfers_from_facility` (`from_facility_id`, `transfer_date`),
  CONSTRAINT `fk_asset_transfers_asset` FOREIGN KEY (`asset_id`) REFERENCES `information_assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ประวัติการโอนย้ายทรัพย์สิน';

-- 3) Disposal / loss requests. Only an approved request sets information_assets.current_status to Disposed/Lost.
-- "One pending request per asset" is enforced by the application under a row lock on information_assets:
-- MySQL does not allow a generated column over asset_id while asset_id has an ON DELETE/UPDATE CASCADE foreign key (error 1901).
CREATE TABLE IF NOT EXISTS `asset_disposal_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `facility_id` int NOT NULL COMMENT 'หน่วยงานเจ้าของ ณ วันที่เสนอ',
  `request_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Disposed=จำหน่าย, Lost=สูญหาย',
  `disposal_method` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Sale, Exchange, Transfer, Destroy, WriteOff',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `event_date` date NOT NULL COMMENT 'วันที่ชำรุด/ตรวจพบสูญหาย/เสนอจำหน่าย',
  `purchase_price` decimal(15,2) DEFAULT NULL COMMENT 'ราคาทุน ณ วันที่เสนอ',
  `book_value` decimal(15,2) DEFAULT NULL COMMENT 'มูลค่าสุทธิโดยประมาณ ณ วันที่เสนอ',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Pending',
  `requested_by_user_id` int DEFAULT NULL,
  `requested_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `decided_by_user_id` int DEFAULT NULL,
  `decided_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `decision_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `approval_document_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'เลขที่หนังสืออนุมัติ',
  `proceeds_amount` decimal(15,2) DEFAULT NULL COMMENT 'เงินที่ได้รับจากการจำหน่าย',
  PRIMARY KEY (`id`),
  KEY `idx_disposal_asset` (`asset_id`, `status`, `requested_at`),
  KEY `idx_disposal_facility_status` (`facility_id`, `status`, `requested_at`),
  KEY `idx_disposal_status` (`status`, `requested_at`),
  CONSTRAINT `chk_disposal_type` CHECK (`request_type` IN ('Disposed','Lost')),
  CONSTRAINT `chk_disposal_method` CHECK (`disposal_method` IS NULL OR `disposal_method` IN ('Sale','Exchange','Transfer','Destroy','WriteOff')),
  CONSTRAINT `chk_disposal_status` CHECK (`status` IN ('Pending','Approved','Rejected','Cancelled')),
  CONSTRAINT `chk_disposal_proceeds` CHECK (`proceeds_amount` IS NULL OR `proceeds_amount` >= 0),
  CONSTRAINT `fk_disposal_asset` FOREIGN KEY (`asset_id`) REFERENCES `information_assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='คำขอจำหน่าย/สูญหายและผลการอนุมัติ';

-- 4) Repair jobs and their status timeline. At most one open job per asset (enforced by the application under the asset row lock).
CREATE TABLE IF NOT EXISTS `asset_repairs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `facility_id` int NOT NULL COMMENT 'หน่วยงานเจ้าของ ณ วันที่แจ้ง',
  `problem` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `priority` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Normal',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Reported',
  `contact` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reported_by_user_id` int DEFAULT NULL,
  `reported_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reported_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status_before` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'สถานะทรัพย์สินก่อนแจ้งซ่อม',
  `assigned_to` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vendor_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `diagnosis` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `resolution` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `cost` decimal(15,2) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `updated_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_repairs_asset` (`asset_id`, `status`, `reported_at`),
  KEY `idx_repairs_facility_status` (`facility_id`, `status`, `reported_at`),
  KEY `idx_repairs_status` (`status`, `reported_at`),
  CONSTRAINT `chk_repair_priority` CHECK (`priority` IN ('Low','Normal','High','Urgent')),
  CONSTRAINT `chk_repair_status` CHECK (`status` IN ('Reported','InProgress','SentToVendor','Completed','Cancelled')),
  CONSTRAINT `chk_repair_cost` CHECK (`cost` IS NULL OR `cost` >= 0),
  CONSTRAINT `fk_repairs_asset` FOREIGN KEY (`asset_id`) REFERENCES `information_assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='งานแจ้งซ่อม/ซ่อมบำรุงทรัพย์สิน';

CREATE TABLE IF NOT EXISTS `asset_repair_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `repair_id` int NOT NULL,
  `from_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `to_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `changed_by_user_id` int DEFAULT NULL,
  `changed_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_repair_logs_repair` (`repair_id`, `changed_at`),
  CONSTRAINT `fk_repair_logs_repair` FOREIGN KEY (`repair_id`) REFERENCES `asset_repairs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ไทม์ไลน์สถานะงานซ่อม';
