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
  `asset_registration_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'เลขทะเบียนทรัพย์สินสารสนเทศ',
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
(20, 6, 3, 'SAT-MNG-HW-0503', 'OPD Workstation 1', 'ใช้บันทึกข้อมูลผู้ป่วยนอกแผนกอายุรกรรม', 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows', 'Windows 11 Pro', NULL, '10.40.2.11', NULL, 'ห้อง OPD แผนกอายุรกรรม', NULL, NULL, 'Broken', 'ทีมสำรวจมะนัง', 'Lenovo', NULL, NULL, 'LNV-OPD-MNG-0503', '2024-05-25', '2026-05-25', '2026-05-11 08:36:58', '2026-05-11 08:36:58');

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
