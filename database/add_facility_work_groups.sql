-- กลุ่มงานสำหรับ ATACS Agent แยกตามหน่วยงาน
-- โรงพยาบาล, สสจ และ สสอ ต้องระบุกลุ่มงานตอนสร้าง enrollment token
-- รพ.สต. ไม่ต้องระบุกลุ่มงาน

CREATE TABLE IF NOT EXISTS `facility_work_groups` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `facility_id` INT NOT NULL COMMENT 'อ้างอิงหน่วยงานจาก health_facilities',
  `work_group_name` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ชื่อกลุ่มงาน เช่น กลุ่มงานไอที, OPD, งานการเงิน',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_facility_work_groups_facility_name` (`facility_id`, `work_group_name`),
  KEY `idx_facility_work_groups_active` (`is_active`),
  CONSTRAINT `fk_facility_work_groups_facility`
    FOREIGN KEY (`facility_id`) REFERENCES `health_facilities` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='กลุ่มงานของหน่วยงานสำหรับระบุในการติดตั้ง ATACS Agent';

ALTER TABLE `facility_work_groups`
  MODIFY COLUMN `work_group_name` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ชื่อกลุ่มงาน เช่น กลุ่มงานไอที, OPD, งานการเงิน';

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facility_work_groups'
      AND INDEX_NAME = 'uk_facility_work_groups_facility_code'
  ),
  'ALTER TABLE `facility_work_groups` DROP INDEX `uk_facility_work_groups_facility_code`',
  'SELECT ''uk_facility_work_groups_facility_code already absent'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facility_work_groups'
      AND COLUMN_NAME = 'work_group_code'
  ),
  'ALTER TABLE `facility_work_groups` DROP COLUMN `work_group_code`',
  'SELECT ''work_group_code already absent'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facility_work_groups'
      AND INDEX_NAME = 'uk_facility_work_groups_facility_name'
  ),
  'ALTER TABLE `facility_work_groups` ADD UNIQUE KEY `uk_facility_work_groups_facility_name` (`facility_id`, `work_group_name`)',
  'SELECT ''uk_facility_work_groups_facility_name already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE fwg
FROM `facility_work_groups` fwg
JOIN `health_facilities` hf ON hf.`id` = fwg.`facility_id`
WHERE hf.`typecode` IN ('สสจ.', 'สสอ.', 'รพ.ทั่วไป', 'รพ.ชุมชน')
  AND fwg.`work_group_name` IN ('สสจ', 'สสอ', 'โรงพยาบาล');

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agent_enrollments'
      AND COLUMN_NAME = 'work_group_id'
  ),
  'ALTER TABLE `agent_enrollments` ADD COLUMN `work_group_id` INT NULL DEFAULT NULL COMMENT ''กลุ่มงานของหน่วยงานที่ใช้สร้าง enrollment token'' AFTER `facility_id`',
  'SELECT ''work_group_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agent_enrollments'
      AND INDEX_NAME = 'idx_agent_enrollments_work_group_id'
  ),
  'ALTER TABLE `agent_enrollments` ADD KEY `idx_agent_enrollments_work_group_id` (`work_group_id`)',
  'SELECT ''idx_agent_enrollments_work_group_id already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agent_enrollments'
      AND COLUMN_NAME = 'work_group_id'
      AND REFERENCED_TABLE_NAME = 'facility_work_groups'
  ),
  'ALTER TABLE `agent_enrollments` ADD CONSTRAINT `fk_agent_enrollments_work_group` FOREIGN KEY (`work_group_id`) REFERENCES `facility_work_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT ''fk_agent_enrollments_work_group already exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
