SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

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

CREATE TABLE `agent_enrollments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `facility_id` int NOT NULL COMMENT 'ผูก enrollment token กับหน่วยงานเดียวเสมอ',
  `work_group_id` int DEFAULT NULL COMMENT 'กลุ่มงานของหน่วยงานที่ใช้สร้าง enrollment token',
  `enrollment_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'ชื่อกำกับชุด token เช่น OPD Ward A',
  `token_hash` char(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'SHA-256 ของ enrollment token',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `expires_at` datetime DEFAULT NULL,
  `created_by_user_id` bigint unsigned DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_enrollments_token_hash` (`token_hash`),
  KEY `idx_agent_enrollments_facility_id` (`facility_id`),
  KEY `idx_agent_enrollments_work_group_id` (`work_group_id`),
  KEY `idx_agent_enrollments_active` (`is_active`),
  CONSTRAINT `fk_agent_enrollments_facility` FOREIGN KEY (`facility_id`) REFERENCES `health_facilities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_agent_enrollments_work_group` FOREIGN KEY (`work_group_id`) REFERENCES `facility_work_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_agent_enrollments_created_by_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Enrollment token สำหรับติดตั้ง ATACS Agent ตามหน่วยงาน';

CREATE TABLE `agent_devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `facility_id` int NOT NULL,
  `enrollment_id` int DEFAULT NULL,
  `linked_asset_id` int DEFAULT NULL COMMENT 'ผูกกับ information_assets เมื่อต้องการสร้าง/อัปเดต asset อัตโนมัติ',
  `agent_uuid` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `agent_key_hash` char(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'SHA-256 ของ device secret หลัง enroll สำเร็จ',
  `device_fingerprint` char(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `hostname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `serial_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bios_serial` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `device_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `manufacturer_brand` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `manufacturer_model` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `operating_system` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `operating_system_version` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `private_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mac_address` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `current_user` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cpu_model` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ram_mb` int DEFAULT NULL,
  `disk_total_gb` int DEFAULT NULL,
  `location_detail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `agent_version` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'online',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `first_seen_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` datetime DEFAULT NULL,
  `last_reported_at` datetime DEFAULT NULL,
  `raw_payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_devices_agent_uuid` (`agent_uuid`),
  UNIQUE KEY `uk_agent_devices_facility_fingerprint` (`facility_id`,`device_fingerprint`),
  KEY `idx_agent_devices_linked_asset_id` (`linked_asset_id`),
  KEY `idx_agent_devices_enrollment_id` (`enrollment_id`),
  KEY `idx_agent_devices_status` (`status`),
  CONSTRAINT `fk_agent_devices_facility` FOREIGN KEY (`facility_id`) REFERENCES `health_facilities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_agent_devices_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `agent_enrollments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_agent_devices_asset` FOREIGN KEY (`linked_asset_id`) REFERENCES `information_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ข้อมูล inventory ที่รายงานจาก ATACS Agent';

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
