-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: db:3306
-- Generation Time: May 11, 2026 at 09:33 AM
-- Server version: 8.0.44
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `stn_atacs`
--

-- --------------------------------------------------------

--
-- Table structure for table `auth_sessions`
--

CREATE TABLE `auth_sessions` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `session_token_hash` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='session login ของผู้ใช้งาน';

--
-- Dumping data for table `auth_sessions`
--

INSERT INTO `auth_sessions` (`id`, `user_id`, `session_token_hash`, `expires_at`, `created_at`) VALUES
(2, 1, '9506568be4b09b3a008cd5cf85b8f5628bdd3f774b8eba02ac8cdb9fe8a0e1cd', '2026-05-18 15:47:57', '2026-05-11 08:47:56');

-- --------------------------------------------------------

--
-- Table structure for table `health_facilities`
--

CREATE TABLE `health_facilities` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ชื่อสถานพยาบาล',
  `typecode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ประเภท เช่น รพ.ทั่วไป, รพ.ชุมชน, รพ.สต., ศสช., สสจ, สสอ., สอน.',
  `changwat` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'สตูล' COMMENT 'จังหวัด',
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ที่อยู่',
  `tambon` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ตำบล',
  `lat` decimal(10,6) NOT NULL COMMENT 'ละติจูด',
  `lon` decimal(10,6) NOT NULL COMMENT 'ลองจิจูด',
  `district_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ชื่ออำเภอที่ตั้ง',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'สถานะการใช้งาน',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ข้อมูลสถานพยาบาลในจังหวัดสตูล';

--
-- Dumping data for table `health_facilities`
--

INSERT INTO `health_facilities` (`id`, `name`, `typecode`, `changwat`, `address`, `tambon`, `lat`, `lon`, `district_name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'รพ.สตูล', 'รพ.ทั่วไป', 'สตูล', '', '', 6.619127, 100.070431, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(2, 'รพ.ควนกาหลง', 'รพ.ชุมชน', 'สตูล', '', '', 6.865899, 99.974614, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(3, 'รพ.ควนโดน', 'รพ.ชุมชน', 'สตูล', '', '', 6.776772, 100.095363, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(4, 'รพ.ท่าแพ', 'รพ.ชุมชน', 'สตูล', '', '', 6.788048, 99.970215, 'ท่าแพ', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(5, 'รพ.ทุ่งหว้า', 'รพ.ชุมชน', 'สตูล', '', '', 7.092565, 99.766717, 'ทุ่งหว้า', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(6, 'รพ.มะนัง', 'รพ.ชุมชน', 'สตูล', '', '', 7.005997, 99.917009, 'มะนัง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(7, 'รพ.ละงู', 'รพ.ชุมชน', 'สตูล', '', '', 6.830630, 99.789470, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(8, 'รพ.สต.เกาะสาหร่าย', 'รพ.สต.', 'สตูล', '', '', 6.670756, 99.862898, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(9, 'รพ.สต.เกาะหลีเป๊ะ', 'รพ.สต.', 'สตูล', '', '', 6.494608, 99.307546, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(10, 'รพ.สต.ขอนคลาน', 'รพ.สต.', 'สตูล', '', '', 7.007281, 99.683968, 'ทุ่งหว้า', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(11, 'รพ.สต.เขาขาว', 'รพ.สต.', 'สตูล', '', '', 6.913993, 99.823899, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(12, 'รพ.สต.คลองขุด', 'รพ.สต.', 'สตูล', '', '', 6.673773, 100.112093, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(13, 'รพ.สต.คลองขุด (สาขา)', 'รพ.สต.', 'สตูล', '', '', 6.644430, 100.073960, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(14, 'รพ.สต.ควนกาหลง', 'รพ.สต.', 'สตูล', '', '', 6.841144, 100.071776, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(15, 'รพ.สต.ควนขัน', 'รพ.สต.', 'สตูล', '', '', 6.625560, 100.044136, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(16, 'รพ.สต.ควนโดน', 'รพ.สต.', 'สตูล', '', '', 6.786933, 100.080886, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(17, 'รพ.สต.เจ๊ะบิลัง', 'รพ.สต.', 'สตูล', '', '', 6.655063, 99.983961, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(18, 'รพ.สต.ตันหยงโป', 'รพ.สต.', 'สตูล', '', '', 6.595043, 99.959177, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(19, 'รพ.สต.ตำมะลัง', 'รพ.สต.', 'สตูล', '', '', 6.537996, 100.052995, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(20, 'รพ.สต.ท่าเรือ', 'รพ.สต.', 'สตูล', '', '', 6.824829, 99.931860, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(21, 'รพ.สต.ทุ่งนุ้ย', 'รพ.สต.', 'สตูล', '', '', 6.857056, 100.110714, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(22, 'รพ.สต.ทุ่งบุหลัง', 'รพ.สต.', 'สตูล', '', '', 7.034680, 99.686530, 'ทุ่งหว้า', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(23, 'รพ.สต.น้ำผุด', 'รพ.สต.', 'สตูล', '', '', 7.023325, 99.847394, 'มะนัง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(24, 'รพ.สต.บ้านกะทูน-พิปูนล้นเกล้า', 'รพ.สต.', 'สตูล', '', '', 6.896269, 100.018926, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(25, 'รพ.สต.บ้านกุบังปะโหลด', 'รพ.สต.', 'สตูล', '', '', 6.743220, 100.100193, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(26, 'รพ.สต.บ้านเกาะยาว  ตำบลปูยู', 'รพ.สต.', 'สตูล', '', '', 6.467061, 100.073379, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(27, 'รพ.สต.บ้านเขาแดง ตำบลป่าแก่บ่อหิน', 'รพ.สต.', 'สตูล', '', '', 7.057724, 99.838397, 'ทุ่งหว้า', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(28, 'รพ.สต.บ้านควน', 'รพ.สต.', 'สตูล', '', '', 6.698670, 100.064454, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(29, 'รพ.สต.บ้านควน ตำบลบ้านควน', 'รพ.สต.', 'สตูล', '', '', 6.702525, 100.066167, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(30, 'รพ.สต.บ้านควนบ่อทอง ตำบลทุ่งนุ้ย', 'รพ.สต.', 'สตูล', '', '', 6.845734, 100.102145, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(31, 'รพ.สต.บ้านคีรีวง ตำบลทุ่งหว้า', 'รพ.สต.', 'สตูล', '', '', 7.092852, 99.809358, 'ทุ่งหว้า', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(32, 'รพ.สต.บ้านฉลุง ตำบลฉลุง', 'รพ.สต.', 'สตูล', '', '', 6.739771, 100.041767, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(33, 'รพ.สต.บ้านตันหยงกลิงตำบลเกาะสาหร่าย', 'รพ.สต.', 'สตูล', '', '', 6.708254, 99.864401, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2026-04-16 09:22:20'),
(34, 'รพ.สต.บ้านตันหยงละไน้ ตำบลแหลมสน', 'รพ.สต.', 'สตูล', '', '', 6.984570, 99.681860, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(35, 'รพ.สต.บ้านทางยาง ตำบลสาคร', 'รพ.สต.', 'สตูล', '', '', 6.827112, 99.875329, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(36, 'รพ.สต.บ้านทุ่ง ตำบลฉลุง', 'รพ.สต.', 'สตูล', '', '', 6.730415, 100.065216, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(37, 'รพ.สต.บ้านทุ่งดินลุ่ม ตำบลป่าแก่บ่อหิน', 'รพ.สต.', 'สตูล', '', '', 7.056881, 99.801982, 'ทุ่งหว้า', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(38, 'รพ.สต.บ้านทุ่งไหม้  ตำบลน้ำผุด', 'รพ.สต.', 'สตูล', '', '', 6.954817, 99.841027, 'มะนัง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(39, 'รพ.สต.บ้านนาทอน ตำบลนาทอน', 'รพ.สต.', 'สตูล', '', '', 7.068572, 99.751935, 'ทุ่งหว้า', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(40, 'รพ.สต.บ้านในเมือง ตำบลละงู', 'รพ.สต.', 'สตูล', '', '', 6.950647, 99.792744, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(41, 'รพ.สต.บ้านบ่อเจ็ดลูก', 'รพ.สต.', 'สตูล', '', '', 6.877568, 99.700002, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(42, 'รพ.สต.บ้านปาเต๊ะ ตำบลเจ๊ะบิลัง', 'รพ.สต.', 'สตูล', '', '', 6.739658, 99.981690, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(43, 'รพ.สต.บ้านแป-ระใต้', 'รพ.สต.', 'สตูล', '', '', 6.817987, 99.926008, 'ท่าแพ', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(44, 'รพ.สต.บ้านผัง 34  ตำบลอุใดเจริญ', 'รพ.สต.', 'สตูล', '', '', 6.879708, 99.911084, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(45, 'รพ.สต.บ้านผัง 50 ตำบลนิคมพัฒนา', 'รพ.สต.', 'สตูล', '', '', 6.941950, 99.885736, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(46, 'รพ.สต.บ้านมะนัง ตำบลปาล์มพัฒนา', 'รพ.สต.', 'สตูล', '', '', 7.062887, 99.914517, 'มะนัง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(47, 'รพ.สต.บ้านวังตง ตำบลนาทอน', 'รพ.สต.', 'สตูล', '', '', 6.985857, 99.751800, 'ทุ่งหว้า', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(48, 'รพ.สต.บ้านวังประจัน ตำบลวังประจัน', 'รพ.สต.', 'สตูล', '', '', 6.757332, 100.145950, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(49, 'รพ.สต.บ้านวังพะเนียด ตำบลเกตรี', 'รพ.สต.', 'สตูล', '', '', 6.679914, 100.097880, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(50, 'รพ.สต.บ้านเหนือคลอง  ตำบลควนกาหลง', 'รพ.สต.', 'สตูล', '', '', 6.995425, 100.022697, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(51, 'รพ.สต.บ้านใหม่ ตำบลควนโพธิ์', 'รพ.สต.', 'สตูล', '', '', 6.778163, 100.025347, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(52, 'รพ.สต.ปากน้ำ', 'รพ.สต.', 'สตูล', '', '', 6.847012, 99.760808, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(53, 'รพ.สต.ปาล์มพัฒนา ', 'รพ.สต.', 'สตูล', '', '', 7.005844, 99.945185, 'มะนัง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(54, 'รพ.สต.ปูยู', 'รพ.สต.', 'สตูล', '', '', 6.513990, 100.099380, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(55, 'รพ.สต.แป-ระ', 'รพ.สต.', 'สตูล', '', '', 6.839275, 99.922096, 'ท่าแพ', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(56, 'รพ.สต.ย่านซื่อ', 'รพ.สต.', 'สตูล', '', '', 6.757064, 100.069106, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(57, 'รพ.สต.ละงู', 'รพ.สต.', 'สตูล', '', '', 6.830146, 99.789926, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(58, 'รพ.สต.สาคร', 'รพ.สต.', 'สตูล', '', '', 6.740557, 99.897902, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(59, 'รพ.สต.ห้วยไทร', 'รพ.สต.', 'สตูล', '', '', 6.862600, 99.872230, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(60, 'รพ.สต.แหลมสน', 'รพ.สต.', 'สตูล', '', '', 6.947910, 99.692131, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(61, 'รพ.สต.อุใดเจริญ อำเภอควนกาหลง', 'รพ.สต.', 'สตูล', '', '', 6.894013, 99.940586, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(62, 'ศสช.กำแพง', 'ศสช.', 'สตูล', '', '', 6.876580, 99.783390, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(63, 'ศสช.ท่าแพ', 'ศสช.', 'สตูล', '', '', 6.788170, 99.970100, 'ท่าแพ', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(64, 'ศสช.พิมาน', 'ศสช.', 'สตูล', '', '', 6.624400, 100.065280, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(65, 'สสจ.สตูล', 'สสจ.', 'สตูล', '', '', 6.619030, 100.070220, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-22 04:25:21'),
(66, 'สสอ.ควนกาหลง', 'สสอ.', 'สตูล', '', '', 6.856620, 100.032570, 'ควนกาหลง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(67, 'สสอ.ควนโดน', 'สสอ.', 'สตูล', '', '', 6.787100, 100.077030, 'ควนโดน', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(68, 'สสอ.ท่าแพ', 'สสอ.', 'สตูล', '', '', 6.790310, 99.969360, 'ท่าแพ', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(69, 'สสอ.มะนัง', 'สสอ.', 'สตูล', '', '', 6.973680, 99.917660, 'มะนัง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(70, 'สสอ.ละงู', 'สสอ.', 'สตูล', '', '', 6.891150, 99.789690, 'ละงู', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(71, 'สสอ.สตูล', 'สสอ.', 'สตูล', '', '', 6.619030, 100.084510, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-22 04:25:14'),
(72, 'สอน.เฉลิมพระเกียรติ', 'สอน.', 'สตูล', '', '', 6.974400, 99.917550, 'มะนัง', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44'),
(73, 'ศสช.ศรีพิมาน', 'ศสช.', 'สตูล', '', '', 6.601774, 100.062040, 'เมืองสตูล', 1, '2025-12-11 02:34:44', '2025-12-11 02:34:44');

-- --------------------------------------------------------

--
-- Table structure for table `information_assets`
--

CREATE TABLE `information_assets` (
  `id` int NOT NULL,
  `survey_id` int NOT NULL COMMENT 'อ้างอิงหัวแบบสำรวจจาก information_asset_surveys',
  `row_no` int DEFAULT NULL COMMENT 'ลำดับจากแบบฟอร์ม',
  `asset_registration_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'เลขทะเบียนทรัพย์สินสารสนเทศ',
  `asset_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ชื่อของอุปกรณ์ หรือ เซิร์ฟเวอร์',
  `usage_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'คำอธิบายการใช้งานอุปกรณ์',
  `owner_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ผู้รับผิดชอบหรือผู้ดูแลจัดการ',
  `asset_category` enum('Hardware','Software') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Hardware' COMMENT 'Primary asset category (Hardware/Software)',
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
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='รายการทรัพย์สินสารสนเทศจากแบบสำรวจของหน่วยบริการ';

--
-- Dumping data for table `information_assets`
--

INSERT INTO `information_assets` (`id`, `survey_id`, `row_no`, `asset_registration_no`, `asset_name`, `usage_description`, `owner_name`, `asset_category`, `asset_group`, `device_type`, `operating_system`, `operating_system_version`, `private_ip`, `public_ip`, `location_detail`, `installed_at`, `last_updated_at`, `current_status`, `updated_by`, `manufacturer_brand`, `manufacturer_model`, `manufacturer_specification`, `serial_number`, `maintenance_start_date`, `maintenance_end_date`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 'SAT-MOPH-HW-0001', 'Core Firewall', 'ควบคุมการเข้าออกเครือข่ายส่วนกลางของจังหวัด', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Firewall', 'FortiOS 7.4', NULL, '10.10.0.1', '203.113.10.5', 'Data Corner ชั้น 2 อาคารอำนวยการ', NULL, NULL, 'Active', 'Sa Admin', 'Fortinet', NULL, NULL, 'FGT90G-SATUL-01', '2024-05-28', '2026-05-28', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(2, 1, 2, 'SAT-MOPH-SYS-0002', 'VM Host A', 'รัน HIS, dashboard และระบบรายงานภายใน', 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.10.0.20', NULL, 'Server Rack A1', NULL, NULL, 'Active', 'NOC Satun', 'Dell', NULL, NULL, 'DL-SATUL-A1', '2024-10-15', '2026-10-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(3, 1, 3, 'SAT-MOPH-NW-0003', 'Core Switch L3', 'กระจายสัญญาณหลักระหว่าง VLAN ภายในสสจ.', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Switch', 'ArubaOS 10.x', NULL, '10.10.0.2', NULL, 'Data Corner ชั้น 2 อาคารอำนวยการ', NULL, NULL, 'Active', 'Sa Admin', 'HP Aruba', NULL, NULL, 'ARB-5400-MOPH-01', '2024-12-31', '2026-12-31', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(4, 1, 4, 'SAT-MOPH-HW-0004', 'UPS ระบบกลาง', 'สำรองไฟสำหรับห้อง Server และ Network ชั้น 2', 'นางสาวสุชาดา ทองมาก', 'Hardware', 'Hardware', 'UPS', 'Firmware (APC)', NULL, '-', NULL, 'ห้อง Server ชั้น 2 อาคารอำนวยการ', NULL, NULL, 'Active', 'Sa Admin', 'APC', NULL, NULL, 'APC-SMART5K-MOPH-01', '2025-03-15', '2027-03-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(5, 2, 1, 'SAT-HOS-HW-0108', 'X-Ray Review Workstation', 'เครื่องอ่านผลภาพถ่ายรังสี', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '172.16.8.21', NULL, 'ห้อง X-Ray OPD', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'HP', NULL, NULL, 'HPXR-8841', '2024-06-11', '2026-06-11', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(6, 2, 2, 'SAT-HOS-NW-0114', 'Radiology Switch', 'กระจายสัญญาณห้องรังสีและ PACS', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '172.16.8.2', NULL, 'Rack R2 ห้องรังสี', NULL, NULL, 'Broken', 'Field Audit 2', 'Cisco', NULL, NULL, 'CSW-RD-0114', '2024-05-19', '2026-05-19', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(7, 2, 3, 'SAT-HOS-SYS-0115', 'HIS Application Server', 'ให้บริการระบบ HIS สำหรับแผนกทั้งหมดของโรงพยาบาล', 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '172.16.1.10', NULL, 'Server Rack หลัก ห้องสื่อสาร', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Dell', NULL, NULL, 'DL-HIS-SRV-HOSP-01', '2024-08-30', '2026-08-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(8, 2, 4, 'SAT-HOS-NW-0116', 'Internet Edge Router', 'เชื่อมต่ออินเทอร์เน็ตหลักของโรงพยาบาล', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Router', 'RouterOS v7', NULL, '172.16.0.1', '49.228.110.20', 'ห้องสื่อสาร ชั้น 1 อาคาร OPD', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'MikroTik', NULL, NULL, 'MTK-RB1100-HOSP-01', '2024-11-20', '2026-11-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(9, 3, 1, 'SAT-LNG-ST-0203', 'NAS Backup Unit', 'เก็บข้อมูลสำรองระบบห้องคลอดและการเงิน', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Storage', 'NAS', 'Synology DSM 7.2', NULL, '10.20.4.10', NULL, 'ห้องแม่ข่าย ชั้น 1', NULL, NULL, 'Inactive', 'ทีมสำรวจละงู', 'Synology', NULL, NULL, 'SYN-0203-LNG', '2024-05-22', '2026-05-22', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(10, 3, 2, 'SAT-LNG-SYS-0204', 'AD Domain Controller', 'จัดการสิทธิ์ผู้ใช้งานในเครือข่ายโรงพยาบาล', 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.20.4.12', '1.20.130.44', 'Server Rack B2', NULL, NULL, 'Active', 'NOC Satun', 'Lenovo', NULL, NULL, 'LNV-0204-DC', '2024-07-30', '2026-07-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(11, 3, 3, 'SAT-LNG-HW-0205', 'Network Laser Printer', 'พิมพ์เอกสารทั่วไปและใบเสร็จรับเงินสำหรับแผนกเวชระเบียน', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '10.20.4.50', NULL, 'ห้องเวชระเบียน ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'HP', NULL, NULL, 'HPP-LJP4015-LNG-01', '2025-01-10', '2027-01-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(12, 4, 1, 'SAT-KLG-HW-0301', 'Firewall UTM', 'ป้องกันเครือข่ายและกรองทราฟฟิคขาเข้า-ขาออกของโรงพยาบาล', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Firewall', 'FortiOS 7.4', NULL, '192.168.1.1', '1.1.228.35', 'Data Room ชั้น 1 อาคารอำนวยการ', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Fortinet', NULL, NULL, 'FGT60F-KLG-01', '2024-09-15', '2026-09-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(13, 4, 2, 'SAT-KLG-NW-0302', 'Core Switch', 'กระจายสัญญาณหลักระหว่างแผนกต่าง ๆ ภายในโรงพยาบาล', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '192.168.1.2', NULL, 'Data Room ชั้น 1 อาคารอำนวยการ', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Cisco', NULL, NULL, 'CSW-KLG-C2960-01', '2024-06-05', '2026-06-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(14, 4, 3, 'SAT-KLG-HW-0303', 'OPD Workstation', 'ใช้บันทึกข้อมูลผู้ป่วยนอกและออกใบสั่งยา', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '192.168.2.44', NULL, 'ห้อง OPD ชั้น 1', NULL, NULL, 'Broken', 'ทีมสำรวจควนกาหลง', 'Lenovo', NULL, NULL, 'LNV-OPD-KLG-0303', '2024-01-01', '2025-12-31', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(15, 5, 1, 'SAT-THW-NW-0401', 'Internet Router', 'เชื่อมต่ออินเทอร์เน็ตผ่าน ISP และทำ NAT สำหรับเครือข่ายภายใน', 'นายสมชาย หาดทิพย์', 'Hardware', 'Network', 'Router', 'RouterOS v7', NULL, '10.30.0.1', '49.49.214.8', 'ห้องสื่อสาร ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'MikroTik', NULL, NULL, 'MTK-CCR1009-THW-01', '2024-07-20', '2026-07-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(16, 5, 2, 'SAT-THW-ST-0402', 'NAS Backup', 'สำรองข้อมูล EMR และภาพถ่ายทางการแพทย์ทุกคืน', 'นายสมชาย หาดทิพย์', 'Hardware', 'Storage', 'NAS', 'Synology DSM 7.2', NULL, '10.30.0.20', NULL, 'ห้อง Server ชั้น 2', NULL, NULL, 'Inactive', 'ทีมสำรวจทุ่งหว้า', 'Synology', NULL, NULL, 'SYN-DS923-THW-01', '2024-05-15', '2026-05-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(17, 5, 3, 'SAT-THW-SYS-0403', 'Antivirus Management Server', 'บริหารจัดการ endpoint protection สำหรับเครื่องในโรงพยาบาลทั้งหมด', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Windows', 'Windows Server 2019', NULL, '10.30.0.30', NULL, 'Server Rack ห้อง Server ชั้น 2', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Dell', NULL, NULL, 'DL-PE340-AV-THW-01', '2024-10-01', '2026-10-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(18, 6, 1, 'SAT-MNG-NW-0501', 'Access Point Controller', 'ควบคุมและกระจายสัญญาณ Wi-Fi ภายในอาคารรักษาพยาบาลทั้งหมด', 'นายรุสดี สาและ', 'Hardware', 'Network', 'Access Point', 'UniFi Network OS', NULL, '10.40.0.10', NULL, 'ชั้น 1 อาคารรักษาพยาบาล', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Ubiquiti', NULL, NULL, 'UAP-PRO-MNG-01', '2024-08-20', '2026-08-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(19, 6, 2, 'SAT-MNG-SYS-0502', 'Patient DB Server', 'ฐานข้อมูลผู้ป่วยและประวัติการรักษาของโรงพยาบาลมะนัง', 'นายรุสดี สาและ', 'Software', 'System', 'Linux', 'Ubuntu Server 22.04 LTS', NULL, '10.40.0.20', NULL, 'ห้อง Server ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'HP', NULL, NULL, 'HPE-ML30-MNG-01', '2024-12-25', '2026-12-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(20, 6, 3, 'SAT-MNG-HW-0503', 'OPD Workstation 1', 'ใช้บันทึกข้อมูลผู้ป่วยนอกแผนกอายุรกรรม', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.40.2.11', NULL, 'ห้อง OPD แผนกอายุรกรรม', NULL, NULL, 'Broken', 'ทีมสำรวจมะนัง', 'Lenovo', NULL, NULL, 'LNV-OPD-MNG-0503', '2024-05-25', '2026-05-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(21, 1, 5, 'SAT-MOPH-HW-0005', 'Server UPS 2', 'สำรองไฟสำรองสำหรับห้องสำเร็จพิมพ์', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Hardware', 'UPS', 'Firmware (APC)', NULL, '-', NULL, 'ห้องสำเร็จพิมพ์ชั้น 1', NULL, NULL, 'Active', 'Sa Admin', 'APC', NULL, NULL, 'APC-2K-MOPH-02', '2025-01-20', '2027-01-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(22, 1, 6, 'SAT-MOPH-NW-0006', 'Access Point AP-1', 'กระจายสัญญาณ Wi-Fi บริเวณชั้น 1 อาคารอำนวยการ', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Access Point', 'Meraki OS', NULL, '10.10.2.1', NULL, 'ห้องรอ ชั้น 1', NULL, NULL, 'Active', 'Sa Admin', 'Cisco Meraki', NULL, NULL, 'MR46-MOPH-01', '2024-11-10', '2026-11-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(23, 1, 7, 'SAT-MOPH-SYS-0007', 'VM Host B', 'รัน Backup System และ Reporting Engine', 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.10.0.21', NULL, 'Server Rack A2', NULL, NULL, 'Active', 'NOC Satun', 'Dell', NULL, NULL, 'DL-SATUL-A2', '2024-10-20', '2026-10-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(24, 1, 8, 'SAT-MOPH-HW-0008', 'Desktop Computer 1', 'ใช้สำหรับการบันทึกข้อมูลและบริหารจัดการ', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '10.10.1.50', NULL, 'ห้องศูนย์สารสนเทศ ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'HP', NULL, NULL, 'HP-DT-MOPH-0008', '2024-03-15', '2026-03-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(25, 1, 9, 'SAT-MOPH-HW-0009', 'Printer Brother B/W', 'พิมพ์เอกสารสีดำขาว', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '10.10.1.51', NULL, 'ห้องศูนย์สารสนเทศ ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Brother', NULL, NULL, 'BRO-L8360-MOPH-01', '2024-02-10', '2026-02-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(26, 2, 5, 'SAT-HOS-HW-0117', 'Desktop Computer IPD', 'ใช้บันทึกข้อมูลผู้ป่วยใน', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '172.16.3.10', NULL, 'ห้อง IPD ชั้น 2', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Dell', NULL, NULL, 'DL-OPT-IPD-HOSP', '2024-04-20', '2026-04-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(27, 2, 6, 'SAT-HOS-HW-0118', 'All-In-One Printer', 'พิมพ์สแกนและถ่ายเอกสารแผนกทั่วไป', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '172.16.3.50', NULL, 'ห้องกลาง OPD', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Canon', NULL, NULL, 'CAN-MF445DW-HOSP', '2025-02-14', '2027-02-14', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(28, 2, 7, 'SAT-HOS-NW-0119', 'Access Point WiFi OPD', 'กระจายสัญญาณ Wi-Fi บริเวณห้อง OPD', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Access Point', 'UniFi Network OS', NULL, '172.16.5.1', NULL, 'มุมเพดาน OPD ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Ubiquiti', NULL, NULL, 'UAP-AC-HOSP-01', '2024-09-05', '2026-09-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(29, 2, 8, 'SAT-HOS-SYS-0120', 'Backup Database Server', 'สำรองฐานข้อมูล HIS รายชั่วโมง', 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '172.16.1.20', NULL, 'Server Rack เซ็กเคนดารี', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Dell', NULL, NULL, 'DL-HIS-BKP-HOSP-02', '2024-09-20', '2026-09-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(30, 2, 9, 'SAT-HOS-HW-0121', 'Digital Scale', 'ชั่งน้ำหนักผู้ป่วยที่นักวิทยาศาสตร์ทางการแพทย์', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องชั่งน้ำหนัก OPD', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'SECA', NULL, NULL, 'SECA-7035-HOSP', '2024-08-10', '2026-08-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(31, 3, 4, 'SAT-LNG-HW-0206', 'Desktop Computer Admin', 'ใช้งานปกติสำหรับเจ้าหน้าที่บริหาร', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.20.2.10', NULL, 'ห้องบริหาร', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Lenovo', NULL, NULL, 'LNV-DT-LNG-0206', '2024-07-15', '2026-07-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(32, 3, 5, 'SAT-LNG-NW-0207', 'Switch PoE 24 Port', 'กระจายไฟและสัญญาณให้แก่อุปกรณ์ PoE', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '10.20.0.5', NULL, 'Rack ห้องสื่อสาร', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Cisco', NULL, NULL, 'CSW-POE-LNG-01', '2024-06-20', '2026-06-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(33, 3, 6, 'SAT-LNG-HW-0208', 'Laptop Mobile Nurse', 'ใช้บันทึกสัญญาณชีพผู้ป่วยรอบตัว', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '10.20.3.25', NULL, 'ห้องพยาบาล', NULL, NULL, 'Broken', 'ทีมสำรวจละงู', 'ASUS', NULL, NULL, 'ASS-LP-LNG-0208', '2024-05-10', '2026-05-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(34, 3, 7, 'SAT-LNG-SYS-0209', 'File Server NFS', 'จัดเก็บข้อมูลแชร์บริเวณเครือข่ายท้องถิ่น', 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Linux', 'Ubuntu Server 22.04 LTS', NULL, '10.20.4.5', NULL, 'Server Rack ห้อง IT', NULL, NULL, 'Inactive', 'ทีมสำรวจละงู', 'HP', NULL, NULL, 'HP-NFS-LNG-01', '2024-03-25', '2026-03-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(35, 3, 8, 'SAT-LNG-HW-0210', 'Multi-Function Printer', 'พิมพ์ สแกน ถ่ายเอกสารหลากหลาย', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '10.20.4.51', NULL, 'ห้องเอกสาร', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Xerox', NULL, NULL, 'XER-WC5845-LNG', '2024-01-20', '2026-01-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(36, 4, 4, 'SAT-KLG-HW-0304', 'Desktop Accounting', 'ใช้บันทึกข้อมูลการเงินและจัดเก็บเงิน', 'นายกมล แซ่โค้ว', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '192.168.2.30', NULL, 'ห้องการเงิน ชั้น 2', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'HP', NULL, NULL, 'HP-AC-KLG-0304', '2024-06-15', '2026-06-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(37, 4, 5, 'SAT-KLG-NW-0305', 'WiFi Access Point Floor 2', 'กระจายสัญญาณ Wi-Fi ชั้น 2', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Access Point', 'Meraki OS', NULL, '192.168.5.1', NULL, 'มุมเพดาน ชั้น 2', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Cisco Meraki', NULL, NULL, 'MR44-KLG-F2', '2024-10-01', '2026-10-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(38, 4, 6, 'SAT-KLG-SYS-0306', 'Accounting Software Server', 'ให้บริการระบบบัญชีอิเล็กทรอนิกส์', 'นายกมล แซ่โค้ว', 'Software', 'System', 'Windows', 'Windows Server 2019', NULL, '192.168.1.20', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-ACC-KLG-01', '2024-08-30', '2026-08-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(39, 4, 7, 'SAT-KLG-HW-0307', 'Barcode Scanner', 'สแกนบาร์โค้ดจากสินค้าและยา', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องคลัง ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Zebra', NULL, NULL, 'ZBR-DS3678-KLG', '2024-04-05', '2026-04-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(40, 4, 8, 'SAT-KLG-HW-0308', 'Label Printer Thermal', 'พิมพ์ฉลากสินค้าและยา', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '192.168.2.55', NULL, 'ห้องคลัง ชั้น 1', NULL, NULL, 'Inactive', 'ทีมสำรวจควนกาหลง', 'Zebra', NULL, NULL, 'ZBR-LP2844Z-KLG', '2024-03-10', '2026-03-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(41, 5, 4, 'SAT-THW-HW-0404', 'Desktop HR Department', 'ใช้สำหรับบันทึกข้อมูลบุคลากร', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '10.30.2.10', NULL, 'ห้อง HR ชั้น 2', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Lenovo', NULL, NULL, 'LNV-DT-THW-0404', '2024-05-20', '2026-05-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(42, 5, 5, 'SAT-THW-NW-0405', 'WiFi Controller Access Points', 'ควบคุมการเชื่อมต่อ Wi-Fi ทั้งหมด', 'นายสมชาย หาดทิพย์', 'Hardware', 'Network', 'Access Point Controller', 'UniFi Network OS', NULL, '10.30.0.15', NULL, 'ห้องสื่อสาร', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Ubiquiti', NULL, NULL, 'UAC-XG-THW-01', '2024-11-15', '2026-11-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(43, 5, 6, 'SAT-THW-HW-0406', 'Portable Laptop Consultant', 'ใช้โดยที่ปรึกษาภายนอกและบริหาร', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.30.3.50', NULL, 'ห้องประชุม', NULL, NULL, 'Broken', 'ทีมสำรวจทุ่งหว้า', 'Apple', NULL, NULL, 'APL-MBP16-THW', '2024-02-28', '2026-02-28', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(44, 5, 7, 'SAT-THW-SYS-0407', 'Web Server Portal', 'ให้บริการเว็บไซต์ภายนอก', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.30.0.40', NULL, 'Server Rack ห้องสื่อสาร', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'HP', NULL, NULL, 'HP-WEB-THW-01', '2024-07-10', '2026-07-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(45, 5, 8, 'SAT-THW-HW-0408', 'Network Printer Color', 'พิมพ์สีเอกสารหลากหลาย', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '10.30.2.60', NULL, 'ห้องสำเร็จพิมพ์', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'HP', NULL, NULL, 'HP-CP5225-THW-01', '2024-12-01', '2026-12-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(46, 6, 4, 'SAT-MNG-HW-0504', 'OPD Workstation 2', 'ใช้บันทึกข้อมูลผู้ป่วยนอกแผนกศัลยกรรม', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.40.2.12', NULL, 'ห้อง OPD แผนกศัลยกรรม', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-OPD-MNG-0504', '2024-06-10', '2026-06-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(47, 6, 5, 'SAT-MNG-NW-0505', 'Network Switch Core', 'กระจายสัญญาณหลักเครือข่ายโรงพยาบาล', 'นายรุสดี สาและ', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '10.40.0.2', NULL, 'Data Center ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Cisco', NULL, NULL, 'CSW-C3750X-MNG-01', '2024-09-25', '2026-09-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(48, 6, 6, 'SAT-MNG-HW-0506', 'Pharmacy Desktop', 'ใช้บันทึกข้อมูลเภสัชกรรม', 'นายรุสดี สาและ', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '10.40.2.20', NULL, 'ห้องเภสัชกรรม ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Lenovo', NULL, NULL, 'LNV-DT-MNG-0506', '2024-04-15', '2026-04-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(49, 6, 7, 'SAT-MNG-SYS-0507', 'Pharmacy Management Server', 'ให้บริการระบบบริหารเภสัชกรรม', 'นายรุสดี สาและ', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '10.40.0.30', NULL, 'Server Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-PHM-MNG-01', '2024-10-10', '2026-10-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(50, 6, 8, 'SAT-MNG-HW-0508', 'Lab Result Workstation', 'ใช้ดูผลแล็บของผู้ป่วย', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.40.2.25', NULL, 'ห้องแล็บ ชั้น 1', NULL, NULL, 'Inactive', 'ทีมสำรวจมะนัง', 'HP', NULL, NULL, 'HP-DT-MNG-0508', '2024-03-05', '2026-03-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(51, 1, 10, 'SAT-MOPH-HW-0010', 'Scanner Document', 'สแกนเอกสารเก่าไปยังระบบดิจิทัล', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องเก็บเอกสาร', NULL, NULL, 'Active', 'Sa Admin', 'Canon', NULL, NULL, 'CAN-DR3010C-MOPH', '2024-08-20', '2026-08-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(52, 1, 11, 'SAT-MOPH-SYS-0011', 'Monitoring System Server', 'ตรวจสอบสถานะเครื่องและเครือข่ายอย่างต่อเนื่อง', 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Linux', 'Ubuntu Server 22.04 LTS', NULL, '10.10.0.50', NULL, 'Server Rack A3', NULL, NULL, 'Active', 'NOC Satun', 'Dell', NULL, NULL, 'DL-NTOP-MOPH-01', '2024-09-30', '2026-09-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(53, 1, 12, 'SAT-MOPH-NW-0012', 'Network Camera Recording', 'บันทึกกิจกรรมภายในอาคาร', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Security Camera', 'Firmware', NULL, '10.10.4.10', NULL, 'ห้องที่ 101 ชั้น 1', NULL, NULL, 'Active', 'Sa Admin', 'Hikvision', NULL, NULL, 'HIK-CAM-MOPH-001', '2024-07-01', '2026-07-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(54, 1, 13, 'SAT-MOPH-HW-0013', 'Projector Meeting Room', 'ฉายภาพสำหรับการประชุม', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องประชุมใหญ่', NULL, NULL, 'Active', 'Sa Admin', 'Epson', NULL, NULL, 'EPS-EB-2250U-MOPH', '2024-05-15', '2026-05-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(55, 1, 14, 'SAT-MOPH-NW-0014', 'Load Balancer Network', 'กระจายภาระการทำงานระหว่างเซิร์ฟเวอร์', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Load Balancer', 'FortiOS 7.4', NULL, '10.10.0.3', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Fortinet', NULL, NULL, 'FGT-LB-MOPH-01', '2024-10-01', '2026-10-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(56, 2, 10, 'SAT-HOS-HW-0122', 'Emergency Call System', 'โทรศัพท์ฉุกเฉินภายในโรงพยาบาล', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'หลายสถานที่ในโรงพยาบาล', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Philips', NULL, NULL, 'PHP-CALL-HOSP-01', '2024-01-10', '2026-01-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(57, 2, 11, 'SAT-HOS-SYS-0123', 'PACS System Server', 'ให้บริการเก็บและค้นหารูปถ่ายทางการแพทย์', 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '172.16.1.30', NULL, 'Server Rack ห้องรังสี', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Dell', NULL, NULL, 'DL-PACS-HOSP-01', '2024-11-01', '2026-11-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(58, 2, 12, 'SAT-HOS-NW-0124', 'Medical Equipment Network', 'เชื่อมต่อเครื่องแพทย์ต่อสัญญาณชีพ', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '172.16.8.5', NULL, 'ห้องวิกฤต ICU', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Cisco', NULL, NULL, 'CSW-ICU-HOSP-01', '2024-08-15', '2026-08-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(59, 2, 13, 'SAT-HOS-HW-0125', 'Patient Monitor Central', 'ติดตามสัญญาณชีพผู้ป่วยจากห้องวิกฤต', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องควบคุม ICU', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Philips', NULL, NULL, 'PHP-MON-ICU-HOSP', '2024-06-20', '2026-06-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(60, 3, 9, 'SAT-LNG-HW-0211', 'Telemedicine Camera', 'ตรวจสอบไข้ผ่านระบบสื่อสารด้วยวิดีโอ', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องปฏิบัติการ', NULL, NULL, 'Inactive', 'ทีมสำรวจละงู', 'Sony', NULL, NULL, 'SNY-TELEM-LNG-01', '2024-09-15', '2026-09-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(61, 3, 10, 'SAT-LNG-NW-0212', 'IP Phone System', 'โทรศัพท์ IP ภายในเครือข่าย', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Network', 'VoIP Phone', 'Embedded OS', NULL, '10.20.2.40', NULL, 'ห้องทำงานทั่วไป', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Cisco', NULL, NULL, 'CSC-IP7965-LNG-01', '2024-02-20', '2026-02-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(62, 3, 11, 'SAT-LNG-HW-0213', 'Digital Whiteboard', 'บอร์ดโต้ตอบสำหรับการประชุม', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องประชุมเล็ก', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'SMART Technologies', NULL, NULL, 'SMA-BOARD-LNG-01', '2024-10-20', '2026-10-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(63, 4, 9, 'SAT-KLG-HW-0309', 'Desktop Data Entry', 'ใช้บันทึกข้อมูลผู้มาสอบรับการสัง', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '192.168.2.40', NULL, 'ห้องสาขา ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-DE-KLG-0309', '2024-07-20', '2026-07-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(64, 4, 10, 'SAT-KLG-NW-0310', 'Video Conferencing Equipment', 'ระบบประชุมผ่านวิดีโอ', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Video Conference', 'Firmware', NULL, '192.168.5.10', NULL, 'ห้องประชุมใหญ่', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Polycom', NULL, NULL, 'PLY-VP8200-KLG', '2024-11-05', '2026-11-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(65, 4, 11, 'SAT-KLG-HW-0311', 'Building Access Control', 'ควบคุมการเข้าออกอาคารด้วยบัตร', 'นายกมล แซ่โค้ว', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ทางเข้าอาคารหลัก', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'HID Global', NULL, NULL, 'HID-ACC-KLG-01', '2024-04-10', '2026-04-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(66, 5, 9, 'SAT-THW-HW-0409', 'Backup Power Supply UPS 2', 'สำรองไฟสำเร็จการให้บัณฑิต', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'UPS', 'Firmware (APC)', NULL, '-', NULL, 'ห้องศูนย์สารสนเทศ', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'APC', NULL, NULL, 'APC-SMART10K-THW', '2025-02-20', '2027-02-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(67, 5, 10, 'SAT-THW-HW-0410', 'Document Scanner', 'สแกนเอกสารเก่าไปยังดิจิทัล', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องเก็บเอกสาร', NULL, NULL, 'Broken', 'ทีมสำรวจทุ่งหว้า', 'Fujitsu', NULL, NULL, 'FUJ-IX500-THW', '2024-01-15', '2026-01-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(68, 5, 11, 'SAT-THW-NW-0411', 'Unified Communications Server', 'ให้บริการโทรศัพท์ IP และการประชุม', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.30.0.45', NULL, 'Server Rack', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Dell', NULL, NULL, 'DL-UC-THW-01', '2024-08-15', '2026-08-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(69, 6, 9, 'SAT-MNG-HW-0509', 'Radiology Workstation', 'ใช้อ่านผลรูปถ่ายรังสีรอบตัว', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.40.2.30', NULL, 'ห้องรังสี ชั้น 2', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-RAD-MNG-0509', '2024-09-01', '2026-09-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(70, 6, 10, 'SAT-MNG-NW-0510', 'Wireless Access Point Outpatient', 'กระจายสัญญาณ Wi-Fi ห้อง OPD ด้านนอก', 'นายรุสดี สาและ', 'Hardware', 'Network', 'Access Point', 'UniFi Network OS', NULL, '10.40.5.5', NULL, 'มุมเพดาน OPD ด้านนอก', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Ubiquiti', NULL, NULL, 'UAP-AC-LR-MNG-01', '2024-06-05', '2026-06-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(71, 1, 15, 'SAT-MOPH-HW-0015', 'Server Rack PDU', 'จัดเก็บไฟฟ้าสำหรับ Server Rack', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Hardware', 'PDU', 'Firmware', NULL, '-', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Schneider Electric', NULL, NULL, 'SCH-PDU-MOPH-01', '2024-09-20', '2026-09-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(72, 1, 16, 'SAT-MOPH-SYS-0016', 'Antivirus Central Server', 'บริหารจัดการการป้องกันไวรัส', 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.10.0.60', NULL, 'Server Rack A4', NULL, NULL, 'Active', 'NOC Satun', 'Dell', NULL, NULL, 'DL-ANTIV-MOPH-01', '2024-11-10', '2026-11-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(73, 2, 14, 'SAT-HOS-HW-0126', 'Laboratory Information System', 'บันทึกผลแล็บและค่าออกแบบ', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '172.16.7.10', NULL, 'ห้องแล็บ ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Lenovo', NULL, NULL, 'LNV-LIS-HOSP-01', '2024-07-30', '2026-07-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(74, 2, 15, 'SAT-HOS-NW-0127', 'Mobile Cart with Tablet', 'ใช้บันทึกสัญญาณชีพผู้ป่วยเคลื่อนที่', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'iOS', 'iOS 17', NULL, '172.16.3.100', NULL, 'บริเวณทั่วไปโรงพยาบาล', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Apple', NULL, NULL, 'APL-IPAD-HOSP-01', '2024-10-05', '2026-10-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(75, 3, 12, 'SAT-LNG-HW-0214', 'Attendance System', 'บันทึกการเข้า-ออกของบุคลากร', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ประตูหลัก', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Zkteco', NULL, NULL, 'ZKT-ATTEND-LNG-01', '2024-03-25', '2026-03-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(76, 3, 13, 'SAT-LNG-SYS-0215', 'Email Mail Server', 'ให้บริการอีเมลภายในองค์กร', 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Linux', 'Ubuntu Server 22.04 LTS', NULL, '10.20.4.20', NULL, 'Server Rack', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'HP', NULL, NULL, 'HP-MAIL-LNG-01', '2024-08-10', '2026-08-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(77, 4, 12, 'SAT-KLG-HW-0312', 'Network Camera IP', 'บันทึกกิจกรรมโรงพยาบาล', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Security Camera', 'Firmware', NULL, '192.168.4.50', NULL, 'หลายสถานที่ในโรงพยาบาล', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Hikvision', NULL, NULL, 'HIK-CAM-KLG-001', '2024-05-10', '2026-05-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(78, 4, 13, 'SAT-KLG-SYS-0313', 'Database Server MySQL', 'เก็บฐานข้อมูลหลักของโรงพยาบาล', 'นายกมล แซ่โค้ว', 'Software', 'System', 'Linux', 'Ubuntu Server 22.04 LTS', NULL, '192.168.1.30', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-DB-KLG-01', '2024-12-05', '2026-12-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(79, 5, 12, 'SAT-THW-HW-0412', 'Interactive Touch Screen Kiosk', 'อุปกรณ์ลงทะเบียนผู้ป่วยอัตโนมัติ', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Windows', 'Windows Embedded', NULL, '10.30.3.100', NULL, 'ห้องรอนอก', NULL, NULL, 'Broken', 'ทีมสำรวจทุ่งหว้า', 'NCR', NULL, NULL, 'NCR-KIOSK-THW-01', '2024-02-01', '2026-02-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(80, 5, 13, 'SAT-THW-NW-0413', 'Network Monitoring Station', 'ติดตามประสิทธิภาพเครือข่าย', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Linux', 'Debian 12', NULL, '10.30.0.50', NULL, 'NOC ห้องสื่อสาร', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'HP', NULL, NULL, 'HP-NETMON-THW-01', '2024-09-01', '2026-09-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(81, 6, 11, 'SAT-MNG-HW-0511', 'Surgery Room Equipment', 'เครื่องมือแสงและการให้ยา', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องผ่าตัด ชั้น 3', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Stryker', NULL, NULL, 'STR-EQUIP-MNG-01', '2024-04-20', '2026-04-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(82, 6, 12, 'SAT-MNG-SYS-0512', 'Billing System Server', 'ให้บริการระบบเรียกเก็บเงิน', 'นายรุสดี สาและ', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.40.0.35', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-BILL-MNG-01', '2024-11-20', '2026-11-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(83, 1, 17, 'SAT-MOPH-NW-0017', 'Gigabit Ethernet Switch', 'กระจายสัญญาณ 1Gbps', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '10.10.0.4', NULL, 'Rack ห้องสื่อสาร', NULL, NULL, 'Active', 'Sa Admin', 'Cisco', NULL, NULL, 'CSW-C2960X-MOPH', '2024-10-15', '2026-10-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(84, 1, 18, 'SAT-MOPH-HW-0018', 'Tape Backup System', 'ห้องดิบอากาศบันทึกข้อมูลวันนี้', 'นางสาวสุชาดา ทองมาก', 'Hardware', 'Hardware', 'Backup Device', 'Firmware', NULL, '-', NULL, 'Server Room', NULL, NULL, 'Active', 'NOC Satun', 'IBM', NULL, NULL, 'IBM-TS4100-MOPH-01', '2024-08-05', '2026-08-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(85, 2, 16, 'SAT-HOS-HW-0128', 'Mobile X-Ray Unit', 'เครื่องเอกซเรย์เคลื่อนที่', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'บริเวณทั่วไปโรงพยาบาล', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Siemens', NULL, NULL, 'SIM-XRAY-HOSP-01', '2024-05-30', '2026-05-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(86, 2, 17, 'SAT-HOS-SYS-0129', 'EMR Integration Middleware', 'เชื่อมต่อระบบบันทึกแบบอิเล็กทรอนิกส์', 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '172.16.1.40', NULL, 'Server Rack หลัก', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'HP', NULL, NULL, 'HP-MIDDLEWARE-HOSP', '2024-09-10', '2026-09-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(87, 3, 14, 'SAT-LNG-HW-0216', 'Conference Video Phone', 'โทรศัพท์วิดีโอประชุม', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '10.20.2.50', NULL, 'ห้องประชุมกระดาน', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Cisco', NULL, NULL, 'CSC-VIDPHONE-LNG-01', '2024-10-10', '2026-10-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(88, 4, 14, 'SAT-KLG-HW-0314', 'Infection Control Monitoring', 'ตรวจสอบการควบคุมการติดเชื้อ', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '192.168.2.50', NULL, 'ห้องเวชระเบียน ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-IC-KLG-0314', '2024-06-20', '2026-06-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(89, 5, 14, 'SAT-THW-HW-0414', 'Blood Bank Refrigerator', 'จัดเก็บเลือดให้ที่สภาพอุณหภูมิเหมาะสม', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องเลือด', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Helmer', NULL, NULL, 'HLM-REFR-THW-01', '2024-03-15', '2026-03-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(90, 6, 13, 'SAT-MNG-HW-0513', 'Ultrasound Equipment', 'เครื่องอัลตราซาวนด์สำหรับการวินิจฉัย', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องสิ่งแพทย์ ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'GE Healthcare', NULL, NULL, 'GEH-ULTRASOUND-MNG', '2024-07-15', '2026-07-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(91, 1, 19, 'SAT-MOPH-HW-0019', 'Console Server', 'จัดการหลายเซิร์ฟเวอร์ผ่านจอเดียว', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '10.10.0.8', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Raritan', NULL, NULL, 'RAR-CONS-MOPH-01', '2024-11-20', '2026-11-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(92, 2, 18, 'SAT-HOS-HW-0130', 'Nurse Call System', 'ระบบเรียกพยาบาลจากห้องพักผู้ป่วย', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'หลายห้องพักผู้ป่วย', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Philips', NULL, NULL, 'PHP-NURSE-HOSP-01', '2024-02-10', '2026-02-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(93, 3, 15, 'SAT-LNG-HW-0217', 'Patient Admission Kiosk', 'อุปกรณ์ลงทะเบียนผู้ป่วยในเบื้องต้น', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Hardware', 'Windows', 'Windows Embedded', NULL, '10.20.1.100', NULL, 'บริเวณลงทะเบียน', NULL, NULL, 'Inactive', 'ทีมสำรวจละงู', 'NCR', NULL, NULL, 'NCR-ADM-LNG-01', '2024-04-05', '2026-04-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(94, 4, 15, 'SAT-KLG-HW-0315', 'Point of Sale Terminal', 'อุปกรณ์ขายยาและจ่ายใบเสร็จ', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Windows', 'Windows Embedded', NULL, '192.168.2.60', NULL, 'ห้องเภสัชกรรม', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'NCR', NULL, NULL, 'NCR-POS-KLG-01', '2024-07-15', '2026-07-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(95, 5, 15, 'SAT-THW-HW-0415', 'ECG Machine', 'เครื่องวัดคลื่นไฟฟ้าหัวใจ', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องตรวจหัวใจ', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Philips', NULL, NULL, 'PHP-ECG-THW-01', '2024-08-20', '2026-08-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(96, 6, 14, 'SAT-MNG-HW-0514', 'Bed Management System', 'ติดตามเตียงผู้ป่วยและการจัดสรร', 'นายรุสดี สาและ', 'Software', 'System', 'Windows', 'Windows Server 2019', NULL, '10.40.0.40', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-BED-MNG-01', '2024-12-10', '2026-12-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(97, 1, 20, 'SAT-MOPH-NW-0020', 'WAN Accelerator', 'เร่งความเร็วการสื่อสารด้วยเครือข่ายกว้าง', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Router', 'FortiOS 7.4', NULL, '10.10.0.5', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Fortinet', NULL, NULL, 'FGT-WAN-MOPH-01', '2024-12-15', '2026-12-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(98, 2, 19, 'SAT-HOS-NW-0131', 'Telephone PBX System', 'ระบบสลับโทรศัพท์ภายในโรงพยาบาล', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'VoIP Phone', 'Embedded OS', NULL, '172.16.0.5', NULL, 'ห้องสื่อสาร ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Avaya', NULL, NULL, 'AVA-PBX-HOSP-01', '2024-03-20', '2026-03-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(99, 3, 16, 'SAT-LNG-HW-0218', 'Public Display Monitor', 'แสดงข้อมูลโครงการและประกาศ', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'บริเวณล็อบบี้', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'LG', NULL, NULL, 'LG-DISPLAY-LNG-01', '2024-11-25', '2026-11-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(100, 4, 16, 'SAT-KLG-SYS-0316', 'Active Directory Server', 'ให้บริการจัดการผู้ใช้และสิทธิ์การเข้าถึง', 'นายกมล แซ่โค้ว', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '192.168.1.40', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-AD-KLG-01', '2024-09-20', '2026-09-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(101, 5, 16, 'SAT-THW-HW-0416', 'Respiratory Equipment', 'เครื่องช่วยหายใจและให้ออกซิเจน', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องวิกฤต ICU', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Philips', NULL, NULL, 'PHP-RESP-THW-01', '2024-10-25', '2026-10-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(102, 6, 15, 'SAT-MNG-SYS-0515', 'Inventory Management System', 'บริหารจัดการสินค้าคงคลัง', 'นายรุสดี สาและ', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.40.0.45', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-INV-MNG-01', '2025-01-05', '2027-01-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(103, 1, 21, 'SAT-MOPH-HW-0021', 'KVM Switch 8 Port', 'เปลี่ยนเซิร์ฟเวอร์จากคีย์บอร์ดเดียว', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Raritan', NULL, NULL, 'RAR-KVM-MOPH-01', '2024-10-20', '2026-10-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(104, 2, 20, 'SAT-HOS-HW-0132', 'Code Blue Alert System', 'แจ้งเตือนในกรณีผู้ป่วยเจ็บกระทันหัน', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'หลายสถานที่ในโรงพยาบาล', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Ascom', NULL, NULL, 'ASC-ALERT-HOSP-01', '2024-01-25', '2026-01-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(105, 3, 17, 'SAT-LNG-SYS-0219', 'Single Sign On Server', 'ตรวจสอบสิทธิ์ผู้ใช้เบื้องต้น', 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.20.4.30', NULL, 'Server Rack', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Dell', NULL, NULL, 'DL-SSO-LNG-01', '2024-10-30', '2026-10-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(106, 4, 17, 'SAT-KLG-HW-0317', 'Time Clock System', 'บันทึกเวลาเข้า-ออกของบุคลากร', 'นายกมล แซ่โค้ว', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ประตูหลัก', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Zkteco', NULL, NULL, 'ZKT-TIME-KLG-01', '2024-05-20', '2026-05-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(107, 5, 17, 'SAT-THW-NW-0417', 'Disaster Recovery Server', 'เซิร์ฟเวอร์สำหรับกู้ภัยธุรกิจในกรณีฉุกเฉิน', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Linux', 'Ubuntu Server 22.04 LTS', NULL, '10.30.0.55', NULL, 'Site ที่ 2 (Offsite)', NULL, NULL, 'Inactive', 'ทีมสำรวจทุ่งหว้า', 'HP', NULL, NULL, 'HP-DR-THW-01', '2024-06-01', '2026-06-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(108, 6, 16, 'SAT-MNG-HW-0516', 'Vital Signs Monitor', 'ติดตามสัญญาณชีพผู้ป่วยแพทย์', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องวิกฤต ICU', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Philips', NULL, NULL, 'PHP-VSM-MNG-01', '2024-08-01', '2026-08-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(109, 1, 22, 'SAT-MOPH-SYS-0022', 'Certificate Authority Server', 'ออกใบรับรองดิจิทัลสำหรับสื่อสารปลอดภัย', 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '10.10.0.70', NULL, 'Server Rack A5', NULL, NULL, 'Active', 'NOC Satun', 'Dell', NULL, NULL, 'DL-CA-MOPH-01', '2024-12-01', '2026-12-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(110, 2, 21, 'SAT-HOS-HW-0133', 'Blood Pressure Monitor', 'อุปกรณ์วัดความดันโลหิต', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องตรวจหัวใจ', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Omron', NULL, NULL, 'OMR-BP-HOSP-01', '2024-04-30', '2026-04-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(111, 3, 18, 'SAT-LNG-HW-0220', 'Touch Panel Computer', 'คอมพิวเตอร์ควบคุมด้วยจอสัมผัส', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Windows', 'Windows Embedded', NULL, '10.20.2.60', NULL, 'ห้องควบคุม', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Lenovo', NULL, NULL, 'LNV-TOUCH-LNG-01', '2024-09-10', '2026-09-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(112, 4, 18, 'SAT-KLG-NW-0318', 'Fiber Optic Transceiver', 'แปลงสัญญาณ Fiber เป็น Copper', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Network Device', 'Firmware', NULL, '192.168.1.50', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Cisco', NULL, NULL, 'CSC-TRANSCEIVER-KLG', '2024-08-10', '2026-08-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(113, 5, 18, 'SAT-THW-HW-0418', 'Defibrillator Equipment', 'เครื่องกระตุ้นหัวใจ', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องฉุกเฉิน', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Philips', NULL, NULL, 'PHP-DEFI-THW-01', '2024-09-15', '2026-09-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(114, 6, 17, 'SAT-MNG-NW-0517', 'Router Management Console', 'ควบคุมเราเตอร์จากระยะไกล', 'นายรุสดี สาและ', 'Hardware', 'Network', 'Router', 'RouterOS v7', NULL, '10.40.0.1', NULL, 'NOC ห้องสื่อสาร', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'MikroTik', NULL, NULL, 'MTK-RB3011-MNG-01', '2024-07-01', '2026-07-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(115, 1, 23, 'SAT-MOPH-HW-0023', 'Network Adapter Card', 'การ์ดเครือข่ายเพิ่มเติมสำหรับเซิร์ฟเวอร์', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Network Device', 'Firmware', NULL, '-', NULL, 'Server Rack', NULL, NULL, 'Active', 'Sa Admin', 'Intel', NULL, NULL, 'INT-NIC-MOPH-01', '2024-11-05', '2026-11-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(116, 2, 22, 'SAT-HOS-SYS-0134', 'Document Management System', 'บันทึกและจัดเก็บเอกสารทางการแพทย์', 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '172.16.1.50', NULL, 'Server Rack', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Dell', NULL, NULL, 'DL-DMS-HOSP-01', '2025-02-01', '2027-02-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(117, 3, 19, 'SAT-LNG-NW-0221', 'Network Traffic Shaper', 'ควบคุมและจัดสรรแบนด์วิดท์เครือข่าย', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Network', 'Network Device', 'Embedded OS', NULL, '10.20.0.10', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Fortinet', NULL, NULL, 'FGT-SHAPE-LNG-01', '2024-06-15', '2026-06-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(118, 4, 19, 'SAT-KLG-HW-0319', 'RFID Reader Terminal', 'อ่านบัตร RFID สำหรับควบคุมการเข้าถึง', 'นายกมล แซ่โค้ว', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ประตูทั่วไป', NULL, NULL, 'Broken', 'ทีมสำรวจควนกาหลง', 'Zebra', NULL, NULL, 'ZBR-RFID-KLG-01', '2024-02-15', '2026-02-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(119, 5, 19, 'SAT-THW-SYS-0419', 'Workforce Management System', 'จัดการตารางเวลาและประสิทธิภาพการทำงาน', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Windows', 'Windows Server 2019', NULL, '10.30.0.60', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Dell', NULL, NULL, 'DL-WFM-THW-01', '2024-10-20', '2026-10-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(120, 6, 18, 'SAT-MNG-HW-0518', 'Oxygen Delivery System', 'ระบบส่งน้ำหนักออกซิเจน', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องฉุกเฉิน', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Philips', NULL, NULL, 'PHP-OXY-MNG-01', '2024-05-10', '2026-05-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(121, 1, 24, 'SAT-MOPH-HW-0024', 'Rack Mount Server 2U', 'ให้บริการการประมวลผลเพิ่มเติม', 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.10.0.71', NULL, 'Server Rack A6', NULL, NULL, 'Active', 'NOC Satun', 'Dell', NULL, NULL, 'DL-R650-MOPH-02', '2024-10-25', '2026-10-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(122, 1, 25, 'SAT-MOPH-NW-0025', 'Redundant WAN Link', 'เชื่อมต่ออินเทอร์เน็ตสำรอง', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Router', 'FortiOS 7.4', NULL, '10.10.0.6', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Fortinet', NULL, NULL, 'FGT-WAN2-MOPH-01', '2024-11-30', '2026-11-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(123, 1, 26, 'SAT-MOPH-HW-0026', 'Desktop Workstation HR', 'ใช้สำหรับบันทึกข้อมูลบุคลากร', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.10.1.52', NULL, 'ห้อง HR ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Lenovo', NULL, NULL, 'LNV-DT-HR-MOPH-01', '2024-02-20', '2026-02-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(124, 1, 27, 'SAT-MOPH-HW-0027', 'Network Printer HP LaserJet', 'พิมพ์เอกสารแผนกงบประมาณ', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '10.10.1.53', NULL, 'ห้องงบประมาณ', NULL, NULL, 'Broken', 'Sa Admin', 'HP', NULL, NULL, 'HP-LJ-MOPH-0027', '2024-03-10', '2026-03-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(125, 2, 23, 'SAT-HOS-HW-0135', 'Specimen Refrigerator', 'เก็บตัวอย่างทางเคมี', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องแล็บ ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Helmer', NULL, NULL, 'HLM-SPEC-HOSP-01', '2024-02-25', '2026-02-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(126, 2, 24, 'SAT-HOS-NW-0136', 'Network Segment Switch', 'แยกเครือข่ายสำหรับความปลอดภัย', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '172.16.8.6', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'HP', NULL, NULL, 'HP-SW-SEG-HOSP-01', '2024-12-20', '2026-12-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(127, 2, 25, 'SAT-HOS-SYS-0137', 'Data Backup Appliance', 'อุปกรณ์สำรองข้อมูลโรงพยาบาล', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Storage', 'Backup Device', 'Firmware', NULL, '172.16.1.60', NULL, 'Server Rack', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Veeam', NULL, NULL, 'VEM-BACKUP-HOSP-01', '2024-08-05', '2026-08-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(128, 2, 26, 'SAT-HOS-HW-0138', 'Pharmacy Label Printer', 'พิมพ์ฉลากยา', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '172.16.3.60', NULL, 'ห้องเภสัชกรรม', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Zebra', NULL, NULL, 'ZBR-PHARM-HOSP-01', '2024-01-30', '2026-01-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(129, 3, 20, 'SAT-LNG-HW-0222', 'Meeting Room Projector', 'ฉายภาพในห้องประชุม', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องประชุมใจกลาง', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Sony', NULL, NULL, 'SNY-PRJ-LNG-01', '2024-07-20', '2026-07-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(130, 3, 21, 'SAT-LNG-NW-0223', 'Redundant Firewall', 'Firewall สำรองสำหรับเครือข่าย', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Network', 'Firewall', 'FortiOS 7.4', NULL, '10.20.0.6', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Inactive', 'ทีมสำรวจละงู', 'Fortinet', NULL, NULL, 'FGT-REDUN-LNG-01', '2024-04-10', '2026-04-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(131, 3, 22, 'SAT-LNG-HW-0224', 'Mobile Workstation', 'สถานีงานเคลื่อนที่สำหรับนักวิจัย', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '10.20.3.30', NULL, 'ห้องเก็บวัสดุ', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Dell', NULL, NULL, 'DL-MB-LNG-0224', '2024-08-15', '2026-08-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(132, 3, 23, 'SAT-LNG-SYS-0225', 'Research Data Server', 'เก็บข้อมูลการวิจัย', 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '10.20.4.40', NULL, 'Server Rack', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Dell', NULL, NULL, 'DL-RES-LNG-01', '2024-11-01', '2026-11-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(133, 4, 20, 'SAT-KLG-HW-0320', 'Public WiFi Hotspot', 'กระจายสัญญาณ Wi-Fi สำหรับประชาชน', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Access Point', 'UniFi Network OS', NULL, '192.168.6.1', NULL, 'บริเวณโถงทางเข้า', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Ubiquiti', NULL, NULL, 'UAP-AC-LR-KLG-02', '2024-09-20', '2026-09-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(134, 4, 21, 'SAT-KLG-NW-0321', 'Fiber Optic Cable Distribution', 'กระจายสัญญาณ Fiber Optic', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Network Device', 'Firmware', NULL, '192.168.1.55', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Cisco', NULL, NULL, 'CSC-FOD-KLG-01', '2024-05-30', '2026-05-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(135, 4, 22, 'SAT-KLG-HW-0322', 'Emergency Power Supply', 'แบตเตอรี่สำรองฉุกเฉิน', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'UPS', 'Firmware (APC)', NULL, '-', NULL, 'ห้องทำการพยาบาล', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'APC', NULL, NULL, 'APC-BX3000-KLG', '2024-04-25', '2026-04-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(136, 4, 23, 'SAT-KLG-SYS-0323', 'Compliance Monitoring Server', 'ตรวจสอบการปฏิบัติตามข้อบังคับ', 'นายกมล แซ่โค้ว', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '192.168.1.45', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-COMP-KLG-01', '2024-10-15', '2026-10-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(137, 5, 20, 'SAT-THW-HW-0420', 'Surgical Lights System', 'ไฟสำหรับห้องผ่าตัด', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องผ่าตัด ชั้น 3', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Philips', NULL, NULL, 'PHP-LIGHT-THW-01', '2024-06-10', '2026-06-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(138, 5, 21, 'SAT-THW-NW-0421', 'Guest Network Segment', 'เครือข่ายสำหรับผู้มาเยี่ยม', 'นายสมชาย หาดทิพย์', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '10.30.0.7', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Cisco', NULL, NULL, 'CSW-GUEST-THW-01', '2024-07-05', '2026-07-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(139, 5, 22, 'SAT-THW-HW-0422', 'Audio Conference System', 'ระบบประชุมเสียงผ่านโทรศัพท์', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '10.30.2.70', NULL, 'ห้องประชุม', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Polycom', NULL, NULL, 'PLY-AUDIO-THW-01', '2024-08-22', '2026-08-22', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(140, 5, 23, 'SAT-THW-SYS-0423', 'Archive Storage Server', 'เก็บข้อมูลที่ไม่ใช้บ่อย', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '10.30.0.70', NULL, 'Server Rack ห้องเก็บ', NULL, NULL, 'Inactive', 'ทีมสำรวจทุ่งหว้า', 'Dell', NULL, NULL, 'DL-ARCH-THW-01', '2024-01-10', '2026-01-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(141, 6, 19, 'SAT-MNG-HW-0519', 'Intensive Care Monitor', 'ติดตามผู้ป่วยในห้องวิกฤตอย่างเข้ม', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องวิกฤต ICU', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'GE Healthcare', NULL, NULL, 'GEH-MONITOR-MNG-02', '2024-09-25', '2026-09-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(142, 6, 20, 'SAT-MNG-NW-0520', 'Guest Access Point', 'กระจายสัญญาณ Wi-Fi ห้องรออพยพ', 'นายรุสดี สาและ', 'Hardware', 'Network', 'Access Point', 'UniFi Network OS', NULL, '10.40.5.6', NULL, 'ห้องรอ OPD', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Ubiquiti', NULL, NULL, 'UAP-AC-GUEST-MNG-01', '2024-03-30', '2026-03-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(143, 6, 21, 'SAT-MNG-SYS-0521', 'Electronic Health Records Backup', 'สำรองข้อมูลแฟ้มสุขภาพอิเล็กทรอนิกส์', 'นายรุสดี สาและ', 'Software', 'System', 'Linux', 'Ubuntu Server 22.04 LTS', NULL, '10.40.0.50', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-EHR-MNG-BKP-01', '2024-11-12', '2026-11-12', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(144, 1, 28, 'SAT-MOPH-NW-0028', 'Video Surveillance Manager', 'บริหารจัดการระบบกล้องวงจรปิด', 'นายอิรฟาน หลงเด็น', 'Software', 'System', 'Linux', 'Ubuntu Server 22.04 LTS', NULL, '10.10.0.80', NULL, 'Server Rack A7', NULL, NULL, 'Active', 'Sa Admin', 'HP', NULL, NULL, 'HP-VSM-MOPH-01', '2024-09-05', '2026-09-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(145, 1, 29, 'SAT-MOPH-HW-0029', 'Serial Port Console Server', 'ควบคุมอุปกรณ์ผ่านพอร์ต Serial', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '10.10.0.9', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Lantronix', NULL, NULL, 'LAN-CONSRV-MOPH', '2024-12-10', '2026-12-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(146, 2, 27, 'SAT-HOS-NW-0139', 'Hospital Wide Intercom', 'ระบบสื่อสารภายในโรงพยาบาล', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'หลายสถานที่ในโรงพยาบาล', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Bosch', NULL, NULL, 'BSC-INTERCOM-HOSP', '2024-02-05', '2026-02-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(147, 2, 28, 'SAT-HOS-HW-0140', 'Hand Sanitizer Dispenser', 'แอลกอฮอล์เจลอัตโนมัติ', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ทางเข้า OPD', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Toto', NULL, NULL, 'TOT-SANITIZE-HOSP', '2024-03-12', '2026-03-12', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(148, 2, 29, 'SAT-HOS-SYS-0141', 'Lab Report Viewer', 'ดูผลแล็บออนไลน์สำหรับแพทย์', 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Windows', 'Windows Server 2019', NULL, '172.16.1.70', NULL, 'Server Rack', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Dell', NULL, NULL, 'DL-LABVW-HOSP-01', '2024-09-30', '2026-09-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(149, 3, 24, 'SAT-LNG-HW-0226', 'Infection Control Workstation', 'ติดตามและเก็บข้อมูลการติดเชื้อ', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.20.2.70', NULL, 'ห้องควบคุมการติดเชื้อ', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Lenovo', NULL, NULL, 'LNV-IC-LNG-0226', '2024-10-05', '2026-10-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(150, 3, 25, 'SAT-LNG-NW-0227', 'Quality Assurance Manager', 'ตรวจสอบคุณภาพระบบเครือข่าย', 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.20.4.50', NULL, 'Server Rack', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'HP', NULL, NULL, 'HP-QA-LNG-01', '2024-08-20', '2026-08-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(151, 3, 26, 'SAT-LNG-HW-0228', 'Portable Ultrasound', 'อัลตราซาวนด์แบบเคลื่อนที่', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องฉุกเฉิน', NULL, NULL, 'Inactive', 'ทีมสำรวจละงู', 'Philips', NULL, NULL, 'PHP-ULTRASOUND-LNG', '2024-04-15', '2026-04-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(152, 4, 24, 'SAT-KLG-HW-0324', 'Automated Drug Dispenser', 'เครื่องจ่ายยาอัตโนมัติ', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องเภสัชกรรม', NULL, NULL, 'Broken', 'ทีมสำรวจควนกาหลง', 'Omnicell', NULL, NULL, 'OMN-DISPENSER-KLG', '2024-05-05', '2026-05-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(153, 4, 25, 'SAT-KLG-NW-0325', 'Network Port Analyzer', 'วิเคราะห์และตรวจหา Port ที่ไม่ต้องการ', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Network Device', 'Firmware', NULL, '192.168.1.60', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Fluke', NULL, NULL, 'FLK-ANALYZER-KLG', '2024-06-20', '2026-06-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(154, 4, 26, 'SAT-KLG-SYS-0326', 'Patient Privacy Manager', 'ตรวจสอบความเป็นส่วนตัวของผู้ป่วย', 'นายกมล แซ่โค้ว', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '192.168.1.50', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-PRIV-KLG-01', '2024-07-25', '2026-07-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(155, 5, 24, 'SAT-THW-HW-0424', 'Digital Pathology Scanner', 'สแกนสไลด์病理ให้เป็นดิจิทัล', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องผ่าตัดด่ว', NULL, NULL, 'Inactive', 'ทีมสำรวจทุ่งหว้า', 'Leica', NULL, NULL, 'LCA-SCANNER-THW', '2024-01-20', '2026-01-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(156, 5, 25, 'SAT-THW-NW-0425', 'Network Intrusion Detection', 'ตรวจหาการโจมตีในเครือข่าย', 'นายสมชาย หาดทิพย์', 'Hardware', 'Network', 'Security Appliance', 'Embedded OS', NULL, '10.30.0.8', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Fortinet', NULL, NULL, 'FGT-IDS-THW-01', '2024-02-10', '2026-02-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(157, 5, 26, 'SAT-THW-HW-0426', 'Video Recording Archival', 'เก็บบันทึกวิดีโอเก่า', 'นายสมชาย หาดทิพย์', 'Hardware', 'Storage', 'Storage Device', 'Firmware', NULL, '-', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Quantum', NULL, NULL, 'QNT-ARCHIVE-THW', '2024-03-20', '2026-03-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(158, 6, 22, 'SAT-MNG-HW-0522', 'Barcode Patient Wristband', 'สร้อยข้อมือ barcode ผู้ป่วย', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องทำการพยาบาล', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Zebra', NULL, NULL, 'ZBR-WRIST-MNG-01', '2024-04-30', '2026-04-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(159, 6, 23, 'SAT-MNG-NW-0523', 'Network Performance Monitor', 'ตรวจสอบประสิทธิภาพเครือข่ายเบื้องต้น', 'นายรุสดี สาและ', 'Software', 'System', 'Linux', 'Debian 12', NULL, '10.40.0.60', NULL, 'NOC ห้องสื่อสาร', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'HP', NULL, NULL, 'HP-NPM-MNG-01', '2024-10-10', '2026-10-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(160, 1, 30, 'SAT-MOPH-HW-0030', 'Database Replication Device', 'จำลองฐานข้อมูลสำหรับ Failover', 'นางสาวสุชาดา ทองมาก', 'Hardware', 'Storage', 'Storage Device', 'Firmware', NULL, '10.10.0.85', NULL, 'Server Rack A8', NULL, NULL, 'Active', 'NOC Satun', 'EMC', NULL, NULL, 'EMC-REPL-MOPH-01', '2024-10-30', '2026-10-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(161, 2, 30, 'SAT-HOS-HW-0142', 'Contact Lens Dispenser', 'อุปกรณ์จ่ายแว่นสำนักตา', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'คลินิกตา', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Essilor', NULL, NULL, 'ESL-LENS-HOSP-01', '2024-05-20', '2026-05-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(162, 2, 31, 'SAT-HOS-NW-0143', 'Secure Email Gateway', 'ตรวจสอบอีเมลก่อนเข้าเครือข่าย', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Security Appliance', 'Embedded OS', NULL, '172.16.0.10', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Fortinet', NULL, NULL, 'FGT-SEMAIL-HOSP', '2024-11-15', '2026-11-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(163, 3, 27, 'SAT-LNG-SYS-0229', 'Statistical Analysis Server', 'วิเคราะห์ข้อมูลทางสถิติ', 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '10.20.4.60', NULL, 'Server Rack', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Dell', NULL, NULL, 'DL-STAT-LNG-01', '2024-12-01', '2026-12-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(164, 3, 28, 'SAT-LNG-HW-0230', 'Specimen Tracking Device', 'ติดตามตัวอย่างสบชายา', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องรับตัวอย่าง', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Ziath', NULL, NULL, 'ZIA-TRACK-LNG-01', '2024-01-05', '2026-01-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(165, 4, 27, 'SAT-KLG-HW-0327', 'Operating Theater Camera', 'กล้องบันทึกการทำผ่าตัด', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องผ่าตัด', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Stryker', NULL, NULL, 'STR-CAMERA-KLG', '2024-06-15', '2026-06-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(166, 4, 28, 'SAT-KLG-SYS-0328', 'Incident Tracking System', 'ติดตามเหตุการณ์และการบำรุงรักษา', 'นายกมล แซ่โค้ว', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '192.168.1.65', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-INCIDENT-KLG', '2024-08-10', '2026-08-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(167, 5, 27, 'SAT-THW-HW-0427', 'Waste Management Monitor', 'ติดตามระบบจัดการขยะทางการแพทย์', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องจัดการขยะ', NULL, NULL, 'Inactive', 'ทีมสำรวจทุ่งหว้า', 'Philips', NULL, NULL, 'PHP-WASTE-THW-01', '2024-02-28', '2026-02-28', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(168, 5, 28, 'SAT-THW-NW-0426', 'Remote Access Server', 'ให้บริการเข้าถึงเครือข่ายจากระยะไกล', 'นายสมชาย หาดทิพย์', 'Hardware', 'Network', 'VPN Appliance', 'Embedded OS', NULL, '10.30.0.9', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Fortinet', NULL, NULL, 'FGT-VPN-THW-01', '2024-03-25', '2026-03-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(169, 5, 29, 'SAT-THW-SYS-0427', 'Crisis Communication System', 'ระบบสื่อสารในสถานการณ์ฉุกเฉิน', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Windows', 'Windows Server 2019', NULL, '10.30.0.65', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Dell', NULL, NULL, 'DL-CRISIS-THW-01', '2024-04-10', '2026-04-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(170, 6, 24, 'SAT-MNG-HW-0524', 'Pharmacy Verification Printer', 'พิมพ์รับรองการจ่ายยา', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Printer', 'Embedded OS', NULL, '10.40.2.40', NULL, 'ห้องเภสัชกรรม', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Zebra', NULL, NULL, 'ZBR-VERIFY-MNG-01', '2024-05-15', '2026-05-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(171, 6, 25, 'SAT-MNG-SYS-0525', 'Schedule Management System', 'บริหารตารางเวลาแพทย์และพยาบาล', 'นายรุสดี สาและ', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.40.0.55', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-SCHED-MNG-01', '2024-12-05', '2026-12-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(172, 1, 31, 'SAT-MOPH-NW-0031', 'Dynamic Network Routing', 'เส้นทางเครือข่ายแบบไดนามิก', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Router', 'FortiOS 7.4', NULL, '10.10.0.7', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Fortinet', NULL, NULL, 'FGT-ROUTE-MOPH-02', '2024-11-01', '2026-11-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(173, 1, 32, 'SAT-MOPH-HW-0032', 'Ethernet Cable Tester', 'ทดสอบคุณภาพสาย Ethernet', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Fluke', NULL, NULL, 'FLK-TEST-MOPH-01', '2024-10-10', '2026-10-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(174, 2, 32, 'SAT-HOS-NW-0144', 'Medical Device Integration Hub', 'เชื่อมต่อเครื่องแพทย์ต่างๆ เข้าเครือข่าย', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Network Device', 'Firmware', NULL, '172.16.8.10', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Cisco', NULL, NULL, 'CSC-HUB-MED-HOSP', '2024-01-20', '2026-01-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(175, 2, 33, 'SAT-HOS-HW-0145', 'Glucose Monitoring System', 'ติดตามระดับน้ำตาลผู้ป่วยเรื้อรัง', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องคลินิกเบาหวาน', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Abbott', NULL, NULL, 'ABT-GLUCOSE-HOSP', '2024-02-10', '2026-02-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(176, 3, 29, 'SAT-LNG-HW-0231', 'Workstation Clinical Notes', 'เขียนบันทึกทางคลินิก', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.20.2.80', NULL, 'ห้องรับผู้ป่วย', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Dell', NULL, NULL, 'DL-CLINICAL-LNG', '2024-09-30', '2026-09-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(177, 3, 30, 'SAT-LNG-NW-0232', 'Network Performance Optimizer', 'เพิ่มประสิทธิภาพเครือข่าย', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Network', 'Network Device', 'Embedded OS', NULL, '10.20.0.15', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Cisco', NULL, NULL, 'CSC-OPT-LNG-01', '2024-10-20', '2026-10-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(178, 4, 29, 'SAT-KLG-HW-0329', 'Specimen Image Archive', 'เก็บภาพตัวอย่างต่างๆ', 'นายกมล แซ่โค้ว', 'Hardware', 'Storage', 'Storage Device', 'Firmware', NULL, '-', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Quantum', NULL, NULL, 'QNT-SPEC-KLG-01', '2024-07-10', '2026-07-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(179, 4, 30, 'SAT-KLG-NW-0330', 'Network Bandwidth Limiter', 'จำกัดความเร็วเครือข่ายต่อผู้ใช้', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Network Device', 'Embedded OS', NULL, '192.168.1.70', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Broken', 'ทีมสำรวจควนกาหลง', 'Fortinet', NULL, NULL, 'FGT-LIMITER-KLG', '2024-08-25', '2026-08-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(180, 5, 30, 'SAT-THW-HW-0428', 'Nutrition Management Workstation', 'บริหารอาหารผู้ป่วย', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '10.30.2.75', NULL, 'ห้องโภชนาการ', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'HP', NULL, NULL, 'HP-NUTR-THW-0428', '2024-10-01', '2026-10-01', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(181, 5, 31, 'SAT-THW-NW-0427', 'IoT Gateway Medical Devices', 'เชื่อมต่อ IoT devices ทางการแพทย์', 'นายสมชาย หาดทิพย์', 'Hardware', 'Network', 'Gateway', 'Embedded OS', NULL, '10.30.0.10', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Cisco', NULL, NULL, 'CSC-IoT-THW-01', '2024-11-05', '2026-11-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(182, 6, 26, 'SAT-MNG-HW-0526', 'Discharge Planning Workstation', 'วางแผนการปล่อยตัวผู้ป่วย', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.40.2.45', NULL, 'ห้องส่งตัวผู้ป่วย', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Lenovo', NULL, NULL, 'LNV-DISCHARGE-MNG', '2024-06-20', '2026-06-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(183, 6, 27, 'SAT-MNG-NW-0527', 'Security Incident Response', 'ตอบสนองต่อเหตุการณ์ความปลอดภัย', 'นายรุสดี สาและ', 'Hardware', 'Network', 'Security Appliance', 'Embedded OS', NULL, '10.40.0.2', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Fortinet', NULL, NULL, 'FGT-SEC-MNG-01', '2024-01-15', '2026-01-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(184, 1, 33, 'SAT-MOPH-SYS-0033', 'Compliance Audit Logging', 'บันทึกข้อมูลสำหรับการตรวจสอบ', 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '10.10.0.90', NULL, 'Server Rack A9', NULL, NULL, 'Active', 'NOC Satun', 'Dell', NULL, NULL, 'DL-AUDIT-MOPH-01', '2024-12-15', '2026-12-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(185, 2, 34, 'SAT-HOS-HW-0146', 'Bed Side Terminal', 'อุปกรณ์ที่เตียงผู้ป่วย', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Windows', 'Windows Embedded', NULL, '172.16.3.110', NULL, 'ห้องพักผู้ป่วยทั่วไป', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Lenovo', NULL, NULL, 'LNV-BEDSIDE-HOSP', '2024-03-30', '2026-03-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(186, 3, 31, 'SAT-LNG-HW-0233', 'Medication Dispensing Robot', 'หุ่นยนต์จ่ายยาอัตโนมัติ', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องเภสัชกรรม', NULL, NULL, 'Broken', 'ทีมสำรวจละงู', 'Baxter', NULL, NULL, 'BAX-ROBOT-LNG-01', '2024-04-20', '2026-04-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(187, 4, 31, 'SAT-KLG-HW-0331', 'Document Imaging Center', 'สแกนจำนวนมากเอกสารได้พร้อมกัน', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องเก็บเอกสาร', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Fujitsu', NULL, NULL, 'FUJ-IMAGING-KLG', '2024-05-10', '2026-05-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(188, 5, 32, 'SAT-THW-HW-0429', 'Environmental Monitoring', 'ติดตามสภาพแวดล้อมในโรงพยาบาล', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'หลายสถานที่ในโรงพยาบาล', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Vaisala', NULL, NULL, 'VAS-ENV-THW-01', '2024-06-05', '2026-06-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(189, 6, 28, 'SAT-MNG-SYS-0528', 'Comprehensive Analytics Platform', 'วิเคราะห์ข้อมูลอย่างครอบคลุม', 'นายรุสดี สาและ', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.40.0.70', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-ANALYTICS-MNG', '2024-07-20', '2026-07-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(190, 1, 34, 'SAT-MOPH-NW-0034', 'Traffic Shaping Device', 'ควบคุมและจัดสรรการไหลของข้อมูล', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Network Device', 'Embedded OS', NULL, '10.10.0.88', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Fortinet', NULL, NULL, 'FGT-TRAFFIC-MOPH', '2024-09-10', '2026-09-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(191, 1, 35, 'SAT-MOPH-HW-0035', 'Optical Fiber Splicer', 'เชื่อมต่อสายไฟเบอร์ออปติก', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Fujikura', NULL, NULL, 'FJK-SPLICER-MOPH', '2024-10-25', '2026-10-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(192, 2, 35, 'SAT-HOS-NW-0147', 'Hospital Call Bell Integration', 'เชื่อมระบบกระดิ่งเรียกพยาบาล', 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '172.16.1.80', NULL, 'Server Rack', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Dell', NULL, NULL, 'DL-CALLBELL-HOSP', '2024-08-30', '2026-08-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(193, 2, 36, 'SAT-HOS-HW-0148', 'Patient Satisfaction Terminal', 'สำรวจความพึงพอใจผู้ป่วย', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Windows', 'Windows Embedded', NULL, '172.16.3.120', NULL, 'บริเวณปล่อยตัวผู้ป่วย', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Lenovo', NULL, NULL, 'LNV-SURVEY-HOSP', '2024-04-15', '2026-04-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(194, 3, 32, 'SAT-LNG-NW-0234', 'Content Filtering Proxy', 'ตรวจสอบและกรองเนื้อหาเว็บ', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Network', 'Security Appliance', 'Embedded OS', NULL, '10.20.0.20', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Fortinet', NULL, NULL, 'FGT-PROXY-LNG-01', '2024-05-25', '2026-05-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(195, 4, 32, 'SAT-KLG-SYS-0332', 'Resource Planning System', 'วางแผนการใช้ทรัพยากรโรงพยาบาล', 'นายกมล แซ่โค้ว', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '192.168.1.75', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-RESOURCE-KLG', '2024-09-05', '2026-09-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(196, 5, 33, 'SAT-THW-SYS-0428', 'Staff Scheduling Assistant', 'ช่วยจัดตารางเวลาบุคลากร', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Windows', 'Windows Server 2019', NULL, '10.30.0.75', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Dell', NULL, NULL, 'DL-STAFF-THW-01', '2024-10-30', '2026-10-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(197, 6, 29, 'SAT-MNG-HW-0529', 'Visitor Management System', 'บริหารการมาเยี่ยมผู้ป่วย', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.40.2.50', NULL, 'ห้องรับแขก', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-VISITOR-MNG', '2024-07-30', '2026-07-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(198, 1, 36, 'SAT-MOPH-HW-0036', 'Environmental Sensor Array', 'เซ็นเซอร์วัดอุณหภูมิ ความชื้น', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Schneider Electric', NULL, NULL, 'SCH-SENSOR-MOPH', '2024-11-20', '2026-11-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(199, 2, 37, 'SAT-HOS-SYS-0149', 'Quality Metrics Dashboard', 'แสดงเมตริกส์คุณภาพการบริการ', 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '172.16.1.90', NULL, 'Server Rack', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Dell', NULL, NULL, 'DL-METRICS-HOSP', '2024-12-10', '2026-12-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(200, 3, 33, 'SAT-LNG-HW-0235', 'Telemedicine Console', 'อุปกรณ์ประชุมผ่านวิดีโอทางการแพทย์', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Windows', 'Windows Embedded', NULL, '10.20.1.110', NULL, 'ห้องประชุม', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Poly', NULL, NULL, 'PLY-TELECON-LNG', '2024-06-15', '2026-06-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(201, 4, 33, 'SAT-KLG-NW-0333', 'Smart Building Integration', 'เชื่อมต่ออาคารอัจฉริยะต่างๆ', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Gateway', 'Embedded OS', NULL, '192.168.1.80', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Cisco', NULL, NULL, 'CSC-SMART-KLG-01', '2024-07-05', '2026-07-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(202, 5, 34, 'SAT-THW-HW-0430', 'Pharmacy Robot Maintenance', 'บำรุงรักษาหุ่นยนต์เภสัชกรรม', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องเภสัชกรรม', NULL, NULL, 'Inactive', 'ทีมสำรวจทุ่งหว้า', 'Baxter', NULL, NULL, 'BAX-MAINT-THW-01', '2024-02-20', '2026-02-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(203, 6, 30, 'SAT-MNG-NW-0529', 'Crisis Management Platform', 'ระบบบริหารการบริหารวิกฤตโรงพยาบาล', 'นายรุสดี สาและ', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.40.0.65', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-CRISIS-MNG-01', '2024-08-15', '2026-08-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(204, 1, 37, 'SAT-MOPH-SYS-0037', 'Change Management Workflow', 'บริหารการเปลี่ยนแปลงระบบ', 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Linux', 'Ubuntu Server 24.04', NULL, '10.10.0.95', NULL, 'Server Rack A10', NULL, NULL, 'Active', 'NOC Satun', 'Dell', NULL, NULL, 'DL-CHANGE-MOPH-01', '2025-01-15', '2027-01-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(205, 2, 38, 'SAT-HOS-NW-0150', 'Disaster Recovery Coordination', 'ประสานงานการกู้ภัยระบบขัดข้อง', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Network Device', 'Embedded OS', NULL, '172.16.0.15', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Cisco', NULL, NULL, 'CSC-DR-HOSP-01', '2024-04-20', '2026-04-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(206, 3, 34, 'SAT-LNG-SYS-0236', 'Grant Management System', 'บริหารทุนอุดหนุนและงบประมาณ', 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.20.4.70', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Dell', NULL, NULL, 'DL-GRANT-LNG-01', '2024-11-25', '2026-11-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(207, 4, 34, 'SAT-KLG-HW-0334', 'Centralized Vaccine Refrigerator', 'เก็บวัคซีนรวมศูนย์', 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ห้องวัคซีน', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Helmer', NULL, NULL, 'HLM-VACCINE-KLG', '2024-05-30', '2026-05-30', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(208, 5, 35, 'SAT-THW-NW-0428', 'Patient Experience Analytics', 'วิเคราะห์ประสบการณ์ผู้ป่วย', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Linux', 'CentOS 7', NULL, '10.30.0.80', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Dell', NULL, NULL, 'DL-PEX-THW-01', '2024-09-20', '2026-09-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(209, 6, 31, 'SAT-MNG-HW-0530', 'Accreditation Assessment Tool', 'เครื่องมือประเมินการรับรอง', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.40.2.55', NULL, 'ห้องบริหาร', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Lenovo', NULL, NULL, 'LNV-ACCRED-MNG', '2024-08-25', '2026-08-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(210, 1, 38, 'SAT-MOPH-NW-0038', 'Cross-Building Connectivity', 'เชื่อมต่อระหว่างอาคารต่างๆ', 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Router', 'FortiOS 7.4', NULL, '10.10.0.11', NULL, 'Data Corner ชั้น 2', NULL, NULL, 'Active', 'Sa Admin', 'Fortinet', NULL, NULL, 'FGT-CROSS-MOPH-01', '2024-12-20', '2026-12-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(211, 2, 39, 'SAT-HOS-HW-0151', 'Staff Directory Kiosk', 'อุปกรณ์ค้นหาที่ตั้งบุคลากร', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Windows', 'Windows Embedded', NULL, '172.16.3.130', NULL, 'บริเวณล็อบบี้หลัก', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Lenovo', NULL, NULL, 'LNV-DIRECTORY-HOSP', '2024-05-20', '2026-05-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(212, 3, 35, 'SAT-LNG-HW-0237', 'Smart ID Badge Reader', 'อ่านบัตรประจำตัว RFID', 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'ทางเข้าระบบหลัก', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'HID Global', NULL, NULL, 'HID-BADGE-LNG-01', '2024-06-10', '2026-06-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(213, 4, 35, 'SAT-KLG-SYS-0335', 'Infection Prevention Tracking', 'ติดตามการป้องกันการติดเชื้อ', 'นายกมล แซ่โค้ว', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '192.168.1.85', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'Dell', NULL, NULL, 'DL-IPT-KLG-01', '2024-10-10', '2026-10-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(214, 5, 36, 'SAT-THW-HW-0431', 'Blood Bank Tracking System', 'ติดตามเลือดในคลังเลือด', 'นายสมชาย หาดทิพย์', 'Hardware', 'Hardware', 'Windows', 'Windows 10 Pro', NULL, '10.30.2.80', NULL, 'ห้องเลือด', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'HP', NULL, NULL, 'HP-BBT-THW-0431', '2024-07-15', '2026-07-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(215, 6, 32, 'SAT-MNG-SYS-0530', 'Demographic Information System', 'บริหารข้อมูลประชากรศาสตร์', 'นายรุสดี สาและ', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.40.0.75', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจมะนัง', 'Dell', NULL, NULL, 'DL-DEMO-MNG-01', '2024-09-10', '2026-09-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(216, 1, 39, 'SAT-MOPH-HW-0039', 'Facility Power Meter', 'วัดการใช้พลังงานไฟฟ้า', 'นายสมชัย ศรีสวาง', 'Hardware', 'Hardware', 'Others', 'Firmware', NULL, '-', NULL, 'หน้าจอตรวจสอบเมตร', NULL, NULL, 'Active', 'Sa Admin', 'Schneider Electric', NULL, NULL, 'SCH-METER-MOPH', '2024-01-05', '2026-01-05', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(217, 2, 40, 'SAT-HOS-NW-0151', 'Emergency Department Network', 'เครือข่ายห้องฉุกเฉิน', 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '172.16.8.15', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ศูนย์ IT รพ.สตูล', 'Cisco', NULL, NULL, 'CSW-ED-HOSP-01', '2024-02-15', '2026-02-15', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(218, 3, 36, 'SAT-LNG-NW-0238', 'Surgical Suite Integration Network', 'เครือข่ายห้องผ่าตัด', 'นายวสันต์ นวลแก้ว', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '10.20.0.25', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจละงู', 'Cisco', NULL, NULL, 'CSW-SURG-LNG-01', '2024-03-20', '2026-03-20', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(219, 4, 36, 'SAT-KLG-NW-0336', 'Intensive Care Network', 'เครือข่ายห้องดูแลผู้ป่วยหนัก', 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Switch', 'Embedded OS', NULL, '192.168.8.1', NULL, 'Data Room ชั้น 1', NULL, NULL, 'Active', 'ทีมสำรวจควนกาหลง', 'HP', NULL, NULL, 'HP-SW-ICU-KLG-01', '2024-04-25', '2026-04-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(220, 5, 37, 'SAT-THW-SYS-0429', 'Hospital Operations Center System', 'ระบบศูนย์ปฏิบัติการโรงพยาบาล', 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Windows', 'Windows Server 2022', NULL, '10.30.0.85', NULL, 'Server Room', NULL, NULL, 'Active', 'ทีมสำรวจทุ่งหว้า', 'Dell', NULL, NULL, 'DL-HOC-THW-01', '2024-11-10', '2026-11-10', '2026-05-11 08:36:58', '2026-05-11 08:36:58');

-- --------------------------------------------------------

--
-- Table structure for table `information_asset_surveys`
--

CREATE TABLE `information_asset_surveys` (
  `id` int NOT NULL,
  `facility_id` int NOT NULL COMMENT 'อ้างอิงหน่วยงานจากตาราง health_facilities',
  `survey_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ชื่อหัวตาราง เช่น ทะเบียนทรัพย์สินด้านสารสนเทศ-อ.เมืองสตูล',
  `personnel_count` int DEFAULT NULL COMMENT 'จำนวนบุคลากรของหน่วยงานผู้กรอก',
  `survey_date` date DEFAULT NULL COMMENT 'วันที่สำรวจ',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'หมายเหตุเพิ่มเติมระดับแบบสำรวจ',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ข้อมูลหัวแบบสำรวจทะเบียนทรัพย์สินสารสนเทศของแต่ละหน่วยบริการ';

--
-- Dumping data for table `information_asset_surveys`
--

INSERT INTO `information_asset_surveys` (`id`, `facility_id`, `survey_title`, `personnel_count`, `survey_date`, `notes`, `created_at`, `updated_at`) VALUES
(1, 65, 'ทะเบียนทรัพย์สินสารสนเทศ สสจ.สตูล ปี 2569', 92, '2026-05-04', NULL, '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(2, 1, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.สตูล ปี 2569', 214, '2026-05-03', NULL, '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(3, 7, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.ละงู ปี 2569', 61, '2026-05-02', NULL, '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(4, 2, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.ควนกาหลง ปี 2569', 78, '2026-05-01', NULL, '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(5, 5, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.ทุ่งหว้า ปี 2569', 55, '2026-04-28', NULL, '2026-05-11 08:36:58', '2026-05-11 08:36:58'),
(6, 6, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.มะนัง ปี 2569', 43, '2026-04-30', NULL, '2026-05-11 08:36:58', '2026-05-11 08:36:58');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint UNSIGNED NOT NULL,
  `thaid_cid` varchar(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'เลขบัตรประชาชนจากการยืนยันตัวตนผ่าน ThaiD (NULL = user ประเภท username/password เท่านั้น)',
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `officer_position` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ตำแหน่งงานของเจ้าหน้าที่',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ชื่อผู้ใช้สำหรับ login แบบ username/password (ไม่บังคับ)',
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'password hash (scrypt) สำหรับ login แบบ username/password — NULL หมายถึงยังไม่ได้ตั้งรหัสผ่าน',
  `role` enum('admin','officer') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'officer',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `thaid_cid`, `full_name`, `email`, `username`, `password_hash`, `role`, `is_active`, `last_login_at`, `created_at`, `updated_at`) VALUES
(1, '3901900015481', 'อิรฟาน หลงเด็น', 'irfan.admin@satun.moph.go.th', 'atacs_admin', 'de195e10198461c169bc3a488fd7b3e0:9adc7e636748aa8c6ffb5462e97b3b4d3cf45841b91156e966b43ce0057ae3067d912e27d36c597cb085e81e98be87cb057a0aa5866634719dc0a2bd11347255', 'admin', 1, '2026-05-11 08:47:56', '2026-05-11 08:32:17', '2026-05-11 08:47:56'),
(2, '3900600012345', 'สุชาดา ทองมาก', 'suchada.officer@satun.moph.go.th', NULL, NULL, 'officer', 1, NULL, '2026-05-11 08:32:17', '2026-05-11 08:32:17'),
(3, NULL, 'นครินทร์ ชายสิทธิ์', 'nakharin.officer@satun.moph.go.th', 'nakharin', 'd6299d396393d346b280ca7ce3c32ccc:a90a60d4287f66a88c9e5fb08b788b4b12dd3122fc08684320ecfbedd3392c4ff2d065a0f41a2b943168d085697adfefbff12ec931345857c8b8f3bdfa2c593c', 'officer', 1, NULL, '2026-05-11 08:32:17', '2026-05-11 08:32:17'),
(4, '1901900088812', 'ธนพล รัตนะ', NULL, 'thanaphon.r', 'f66a5feeeab628babfdeb63449c656a2:f613edc5424966ad8f44e1cf3660dd46d4b2dc72c63eeb06433a5c564f2a2532066a923ce1e91e4c14fe0e9fd6d3db21ef2b1207016999f64b3089ed834dcd30', 'officer', 1, NULL, '2026-05-11 08:32:17', '2026-05-11 08:32:17');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `auth_sessions`
--
ALTER TABLE `auth_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_auth_sessions_token` (`session_token_hash`),
  ADD KEY `idx_auth_sessions_user_id` (`user_id`),
  ADD KEY `idx_auth_sessions_expires_at` (`expires_at`);

--
-- Indexes for table `health_facilities`
--
ALTER TABLE `health_facilities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_typecode` (`typecode`),
  ADD KEY `idx_location` (`lat`,`lon`),
  ADD KEY `idx_district` (`district_name`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `information_assets`
--
ALTER TABLE `information_assets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_information_assets_survey_asset_registration_no` (`survey_id`,`asset_registration_no`),
  ADD KEY `idx_information_assets_row_no` (`row_no`),
  ADD KEY `idx_information_assets_asset_group` (`asset_group`),
  ADD KEY `idx_information_assets_device_type` (`device_type`),
  ADD KEY `idx_information_assets_current_status` (`current_status`),
  ADD KEY `idx_information_assets_serial_number` (`serial_number`),
  ADD KEY `idx_information_assets_asset_category` (`asset_category`);

--
-- Indexes for table `information_asset_surveys`
--
ALTER TABLE `information_asset_surveys`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_information_asset_surveys_facility_id` (`facility_id`),
  ADD KEY `idx_information_asset_surveys_survey_date` (`survey_date`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_users_thaid_cid` (`thaid_cid`),
  ADD UNIQUE KEY `uk_users_email` (`email`),
  ADD UNIQUE KEY `uk_users_username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `auth_sessions`
--
ALTER TABLE `auth_sessions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `health_facilities`
--
ALTER TABLE `health_facilities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=74;

--
-- AUTO_INCREMENT for table `information_assets`
--
ALTER TABLE `information_assets`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `information_asset_surveys`
--
ALTER TABLE `information_asset_surveys`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `auth_sessions`
--
ALTER TABLE `auth_sessions`
  ADD CONSTRAINT `fk_auth_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `information_assets`
--
ALTER TABLE `information_assets`
  ADD CONSTRAINT `fk_information_assets_survey` FOREIGN KEY (`survey_id`) REFERENCES `information_asset_surveys` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `information_asset_surveys`
--
ALTER TABLE `information_asset_surveys`
  ADD CONSTRAINT `fk_information_asset_surveys_facility` FOREIGN KEY (`facility_id`) REFERENCES `health_facilities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
