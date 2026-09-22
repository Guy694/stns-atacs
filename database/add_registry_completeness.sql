-- ทะเบียนครุภัณฑ์รอบเพิ่มเติม: เลขที่คำสั่งคณะกรรมการตรวจนับ, ข้อมูลการได้มา, ขั้นดำเนินการจำหน่ายจริง และการยืม-คืน
-- Prerequisites: information_assets.sql, add_inspection_workflow.sql, migrate_purchase_fields.sql, add_asset_lifecycle.sql
-- Additive and repeatable: adds nullable columns and one new table only; no existing row, column or ID changes.
-- MySQL DDL auto-commits. Take a backup (mysqldump) and check the file is not empty before running.

-- asset_inspections.committee_order_no
SET @has_1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspections' AND COLUMN_NAME = 'committee_order_no');
SET @sql_1 := IF(@has_1 = 0, 'ALTER TABLE `asset_inspections` ADD COLUMN `committee_order_no` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''เลขที่คำสั่งแต่งตั้งคณะกรรมการตรวจสอบพัสดุ''', 'SELECT ''asset_inspections.committee_order_no already exists'' AS migration_note');
PREPARE stmt_1 FROM @sql_1;
EXECUTE stmt_1;
DEALLOCATE PREPARE stmt_1;

-- asset_inspections.committee_order_date
SET @has_2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspections' AND COLUMN_NAME = 'committee_order_date');
SET @sql_2 := IF(@has_2 = 0, 'ALTER TABLE `asset_inspections` ADD COLUMN `committee_order_date` DATE NULL COMMENT ''วันที่ลงนามคำสั่งแต่งตั้ง'' AFTER `committee_order_no`', 'SELECT ''asset_inspections.committee_order_date already exists'' AS migration_note');
PREPARE stmt_2 FROM @sql_2;
EXECUTE stmt_2;
DEALLOCATE PREPARE stmt_2;

-- information_assets.funding_source
SET @has_3 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'funding_source');
SET @sql_3 := IF(@has_3 = 0, 'ALTER TABLE `information_assets` ADD COLUMN `funding_source` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''แหล่งเงิน: Budget, Maintenance, Fund, Donation, Other'' AFTER `purchase_order_no`', 'SELECT ''information_assets.funding_source already exists'' AS migration_note');
PREPARE stmt_3 FROM @sql_3;
EXECUTE stmt_3;
DEALLOCATE PREPARE stmt_3;

-- information_assets.acquisition_method
SET @has_4 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'acquisition_method');
SET @sql_4 := IF(@has_4 = 0, 'ALTER TABLE `information_assets` ADD COLUMN `acquisition_method` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''วิธีได้มา: EBidding, EMarket, Selection, Specific, Donation, Transfer, Other'' AFTER `funding_source`', 'SELECT ''information_assets.acquisition_method already exists'' AS migration_note');
PREPARE stmt_4 FROM @sql_4;
EXECUTE stmt_4;
DEALLOCATE PREPARE stmt_4;

-- information_assets.vendor_name
SET @has_5 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'vendor_name');
SET @sql_5 := IF(@has_5 = 0, 'ALTER TABLE `information_assets` ADD COLUMN `vendor_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''ผู้ขาย/ผู้รับจ้าง/ผู้บริจาค'' AFTER `acquisition_method`', 'SELECT ''information_assets.vendor_name already exists'' AS migration_note');
PREPARE stmt_5 FROM @sql_5;
EXECUTE stmt_5;
DEALLOCATE PREPARE stmt_5;

-- information_assets.warranty_end_date
SET @has_6 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'warranty_end_date');
SET @sql_6 := IF(@has_6 = 0, 'ALTER TABLE `information_assets` ADD COLUMN `warranty_end_date` DATE NULL COMMENT ''วันสิ้นสุดการรับประกัน'' AFTER `vendor_name`', 'SELECT ''information_assets.warranty_end_date already exists'' AS migration_note');
PREPARE stmt_6 FROM @sql_6;
EXECUTE stmt_6;
DEALLOCATE PREPARE stmt_6;

-- information_assets.unit_name
SET @has_7 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'unit_name');
SET @sql_7 := IF(@has_7 = 0, 'ALTER TABLE `information_assets` ADD COLUMN `unit_name` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''หน่วยนับ เช่น เครื่อง ตัว ชุด'' AFTER `warranty_end_date`', 'SELECT ''information_assets.unit_name already exists'' AS migration_note');
PREPARE stmt_7 FROM @sql_7;
EXECUTE stmt_7;
DEALLOCATE PREPARE stmt_7;

-- asset_disposal_requests.fact_finding_note
SET @has_8 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_disposal_requests' AND COLUMN_NAME = 'fact_finding_note');
SET @sql_8 := IF(@has_8 = 0, 'ALTER TABLE `asset_disposal_requests` ADD COLUMN `fact_finding_note` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''ผลการสอบหาข้อเท็จจริง (กรณีสูญหาย)'' AFTER `reason`', 'SELECT ''asset_disposal_requests.fact_finding_note already exists'' AS migration_note');
PREPARE stmt_8 FROM @sql_8;
EXECUTE stmt_8;
DEALLOCATE PREPARE stmt_8;

-- asset_disposal_requests.executed_on
SET @has_9 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_disposal_requests' AND COLUMN_NAME = 'executed_on');
SET @sql_9 := IF(@has_9 = 0, 'ALTER TABLE `asset_disposal_requests` ADD COLUMN `executed_on` DATE NULL COMMENT ''วันที่ดำเนินการจำหน่ายจริง'' AFTER `proceeds_amount`', 'SELECT ''asset_disposal_requests.executed_on already exists'' AS migration_note');
PREPARE stmt_9 FROM @sql_9;
EXECUTE stmt_9;
DEALLOCATE PREPARE stmt_9;

-- asset_disposal_requests.execution_document_no
SET @has_10 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_disposal_requests' AND COLUMN_NAME = 'execution_document_no');
SET @sql_10 := IF(@has_10 = 0, 'ALTER TABLE `asset_disposal_requests` ADD COLUMN `execution_document_no` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''เลขที่ใบเสร็จ/หลักฐานการจำหน่าย'' AFTER `executed_on`', 'SELECT ''asset_disposal_requests.execution_document_no already exists'' AS migration_note');
PREPARE stmt_10 FROM @sql_10;
EXECUTE stmt_10;
DEALLOCATE PREPARE stmt_10;

-- asset_disposal_requests.execution_note
SET @has_11 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_disposal_requests' AND COLUMN_NAME = 'execution_note');
SET @sql_11 := IF(@has_11 = 0, 'ALTER TABLE `asset_disposal_requests` ADD COLUMN `execution_note` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL AFTER `execution_document_no`', 'SELECT ''asset_disposal_requests.execution_note already exists'' AS migration_note');
PREPARE stmt_11 FROM @sql_11;
EXECUTE stmt_11;
DEALLOCATE PREPARE stmt_11;

-- asset_disposal_requests.executed_by_user_id
SET @has_12 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_disposal_requests' AND COLUMN_NAME = 'executed_by_user_id');
SET @sql_12 := IF(@has_12 = 0, 'ALTER TABLE `asset_disposal_requests` ADD COLUMN `executed_by_user_id` INT NULL AFTER `execution_note`', 'SELECT ''asset_disposal_requests.executed_by_user_id already exists'' AS migration_note');
PREPARE stmt_12 FROM @sql_12;
EXECUTE stmt_12;
DEALLOCATE PREPARE stmt_12;

-- asset_disposal_requests.executed_by
SET @has_13 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_disposal_requests' AND COLUMN_NAME = 'executed_by');
SET @sql_13 := IF(@has_13 = 0, 'ALTER TABLE `asset_disposal_requests` ADD COLUMN `executed_by` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL AFTER `executed_by_user_id`', 'SELECT ''asset_disposal_requests.executed_by already exists'' AS migration_note');
PREPARE stmt_13 FROM @sql_13;
EXECUTE stmt_13;
DEALLOCATE PREPARE stmt_13;

-- asset_disposal_requests.executed_recorded_at
SET @has_14 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_disposal_requests' AND COLUMN_NAME = 'executed_recorded_at');
SET @sql_14 := IF(@has_14 = 0, 'ALTER TABLE `asset_disposal_requests` ADD COLUMN `executed_recorded_at` DATETIME NULL AFTER `executed_by`', 'SELECT ''asset_disposal_requests.executed_recorded_at already exists'' AS migration_note');
PREPARE stmt_14 FROM @sql_14;
EXECUTE stmt_14;
DEALLOCATE PREPARE stmt_14;

-- Loans (ยืม-คืน). The asset keeps its status while on loan; at most one open loan per asset (enforced by the application under the asset row lock).
CREATE TABLE IF NOT EXISTS `asset_loans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `facility_id` int NOT NULL COMMENT 'หน่วยงานเจ้าของ ณ วันที่ยืม',
  `borrower_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `borrower_unit` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'หน่วยงาน/กลุ่มงานของผู้ยืม',
  `borrower_contact` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `purpose` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `loaned_on` date NOT NULL,
  `due_on` date NOT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'OnLoan',
  `returned_on` date DEFAULT NULL,
  `return_condition` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Good=สภาพปกติ, Damaged=ชำรุด',
  `return_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_by_user_id` int DEFAULT NULL,
  `created_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `returned_by_user_id` int DEFAULT NULL,
  `returned_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `returned_recorded_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_loans_asset` (`asset_id`, `status`, `loaned_on`),
  KEY `idx_loans_facility_status` (`facility_id`, `status`, `due_on`),
  CONSTRAINT `chk_loan_status` CHECK (`status` IN ('OnLoan','Returned','Cancelled')),
  CONSTRAINT `chk_loan_condition` CHECK (`return_condition` IS NULL OR `return_condition` IN ('Good','Damaged')),
  CONSTRAINT `chk_loan_dates` CHECK (`due_on` >= `loaned_on`),
  CONSTRAINT `fk_loans_asset` FOREIGN KEY (`asset_id`) REFERENCES `information_assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='การยืม-คืนครุภัณฑ์';
