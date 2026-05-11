-- MySQL schema for information asset inventory surveys
-- Derived from the published Google Sheet header for Satun provincial health facilities.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------

--
-- Table structure for table `information_asset_surveys`
--

CREATE TABLE `information_asset_surveys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `facility_id` int NOT NULL COMMENT 'อ้างอิงหน่วยงานจากตาราง health_facilities',
  `survey_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ชื่อหัวตาราง เช่น ทะเบียนทรัพย์สินด้านสารสนเทศ-อ.เมืองสตูล',
  `personnel_count` int DEFAULT NULL COMMENT 'จำนวนบุคลากรของหน่วยงานผู้กรอก',
  `survey_date` date DEFAULT NULL COMMENT 'วันที่สำรวจ',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'หมายเหตุเพิ่มเติมระดับแบบสำรวจ',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_information_asset_surveys_facility_id` (`facility_id`),
  KEY `idx_information_asset_surveys_survey_date` (`survey_date`),
  CONSTRAINT `fk_information_asset_surveys_facility` FOREIGN KEY (`facility_id`) REFERENCES `health_facilities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ข้อมูลหัวแบบสำรวจทะเบียนทรัพย์สินสารสนเทศของแต่ละหน่วยบริการ';

-- --------------------------------------------------------

--
-- Table structure for table `information_assets`
--

CREATE TABLE `information_assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `survey_id` int NOT NULL COMMENT 'อ้างอิงหัวแบบสำรวจจาก information_asset_surveys',
  `row_no` int DEFAULT NULL COMMENT 'ลำดับจากแบบฟอร์ม',
  `asset_registration_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'เลขทะเบียนทรัพย์สินสารสนเทศ',
  `asset_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ชื่อของอุปกรณ์ หรือ เซิร์ฟเวอร์',
  `usage_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'คำอธิบายการใช้งานอุปกรณ์',
  `owner_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ผู้รับผิดชอบหรือผู้ดูแลจัดการ',
  `asset_category` enum('Hardware','Software') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Hardware' COMMENT 'หมวดทรัพย์สินหลัก (Hardware/Software)',
  `asset_group` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'กลุ่ม เช่น Hardware, System, Network, Storage',
  `device_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ประเภทอุปกรณ์ เช่น Firewall, Windows, Linux หรืออื่นๆ',
  `operating_system` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Operating System (ระบบปฏิบัติการ)',
  `operating_system_version` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Operating System Version (เวอร์ชันของระบบปฏิบัติการ)',
  `private_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Private IP',
  `public_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Public IP',
  `location_detail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ที่ตั้ง (Location)',
  `installed_at` date DEFAULT NULL COMMENT 'วันติดตั้ง',
  `last_updated_at` date DEFAULT NULL COMMENT 'วันที่ Update ตามแบบฟอร์ม',
  `current_status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'สถานะปัจจุบัน เช่น ใช้งานได้, ชำรุด, Inactive',
  `updated_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ชื่อผู้ Update',
  `manufacturer_brand` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ยี่ห้อ',
  `manufacturer_model` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'รุ่น',
  `manufacturer_specification` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Specification',
  `serial_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Serial number',
  `maintenance_start_date` date DEFAULT NULL COMMENT 'วันที่เริ่มสัญญา',
  `maintenance_end_date` date DEFAULT NULL COMMENT 'วันสิ้นสุดสัญญา',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_information_assets_survey_asset_registration_no` (`survey_id`,`asset_registration_no`),
  KEY `idx_information_assets_row_no` (`row_no`),
  KEY `idx_information_assets_asset_category` (`asset_category`),
  KEY `idx_information_assets_asset_group` (`asset_group`),
  KEY `idx_information_assets_device_type` (`device_type`),
  KEY `idx_information_assets_current_status` (`current_status`),
  KEY `idx_information_assets_serial_number` (`serial_number`),
  CONSTRAINT `fk_information_assets_survey` FOREIGN KEY (`survey_id`) REFERENCES `information_asset_surveys` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='รายการทรัพย์สินสารสนเทศจากแบบสำรวจของหน่วยบริการ';

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;