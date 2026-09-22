-- เลขครุภัณฑ์แบบ รหัสหน่วยงาน + เลข, รหัสสินทรัพย์ (GFMIS), รอบตรวจนับตามกลุ่มงาน และคณะกรรมการตรวจนับ
-- Additive and repeatable. Existing asset numbers are not rewritten: asset_registration_no keeps its value and
-- the displayed number is asset_code_prefix + asset_registration_no (a prefix already present is not doubled).

-- 1) Per-asset code prefix (e.g. สสจ.) and accounting asset code (รหัสสินทรัพย์)
SET @has_assetcodeprefix := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'asset_code_prefix');
SET @sql_assetcodeprefix := IF(@has_assetcodeprefix = 0, 'ALTER TABLE `information_assets` ADD COLUMN `asset_code_prefix` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''รหัสหน่วยงานนำหน้าเลขครุภัณฑ์ เช่น สสจ.'' AFTER `row_no`', 'SELECT ''information_assets.asset_code_prefix already exists'' AS migration_note');
PREPARE stmt_assetcodeprefix FROM @sql_assetcodeprefix;
EXECUTE stmt_assetcodeprefix;
DEALLOCATE PREPARE stmt_assetcodeprefix;

SET @has_assetaccountingcode := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'information_assets' AND COLUMN_NAME = 'asset_accounting_code');
SET @sql_assetaccountingcode := IF(@has_assetaccountingcode = 0, 'ALTER TABLE `information_assets` ADD COLUMN `asset_accounting_code` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''รหัสสินทรัพย์ (เช่น เลขสินทรัพย์ GFMIS)'' AFTER `asset_registration_no`', 'SELECT ''information_assets.asset_accounting_code already exists'' AS migration_note');
PREPARE stmt_assetaccountingcode FROM @sql_assetaccountingcode;
EXECUTE stmt_assetaccountingcode;
DEALLOCATE PREPARE stmt_assetaccountingcode;

-- 2) Facility default prefix, used to pre-fill new assets
SET @has_assetcodeprefix := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'health_facilities' AND COLUMN_NAME = 'asset_code_prefix');
SET @sql_assetcodeprefix := IF(@has_assetcodeprefix = 0, 'ALTER TABLE `health_facilities` ADD COLUMN `asset_code_prefix` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT ''รหัสหน่วยงานเริ่มต้นสำหรับเลขครุภัณฑ์''', 'SELECT ''health_facilities.asset_code_prefix already exists'' AS migration_note');
PREPARE stmt_assetcodeprefix FROM @sql_assetcodeprefix;
EXECUTE stmt_assetcodeprefix;
DEALLOCATE PREPARE stmt_assetcodeprefix;

-- 3) Inspection rounds may be scoped to one work group
SET @has_workgroupid := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_inspections' AND COLUMN_NAME = 'work_group_id');
SET @sql_workgroupid := IF(@has_workgroupid = 0, 'ALTER TABLE `asset_inspections` ADD COLUMN `work_group_id` INT NULL COMMENT ''กลุ่มงานที่ตรวจนับ (NULL = ทั้งหน่วยงาน)'' AFTER `facility_id`', 'SELECT ''asset_inspections.work_group_id already exists'' AS migration_note');
PREPARE stmt_workgroupid FROM @sql_workgroupid;
EXECUTE stmt_workgroupid;
DEALLOCATE PREPARE stmt_workgroupid;

-- 4) Inspection committee: 1 chair + members, printed as signatures on the count sheet
CREATE TABLE IF NOT EXISTS `asset_inspection_committee` (
  `id` int NOT NULL AUTO_INCREMENT,
  `inspection_id` int NOT NULL,
  `seq` tinyint unsigned NOT NULL COMMENT 'ลำดับ 1 = ประธานกรรมการ',
  `role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'member',
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `position` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'ตำแหน่ง',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inspection_committee_seq` (`inspection_id`, `seq`),
  CONSTRAINT `chk_inspection_committee_role` CHECK (`role` IN ('chair','member')),
  CONSTRAINT `fk_inspection_committee_inspection` FOREIGN KEY (`inspection_id`) REFERENCES `asset_inspections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='คณะกรรมการตรวจนับพัสดุรายรอบ';
