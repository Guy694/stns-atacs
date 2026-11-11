-- บันทึกการเข้าชม (IP + หน้า + ผู้ใช้) และตำแหน่งโดยประมาณของ IP สำหรับเมนู ความปลอดภัยระบบ › ผู้เข้าใช้งาน
-- เก็บ 90 วัน (VISITOR_LOG_RETENTION_DAYS) — งาน cron daily-summary ลบของเก่าให้อัตโนมัติ
-- รันซ้ำได้ (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS `visitor_access_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `visited_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `area` enum('public','staff') NOT NULL DEFAULT 'public',
  `path` varchar(255) NOT NULL,
  `referrer_host` varchar(120) DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `role` varchar(20) DEFAULT NULL,
  `device` varchar(20) DEFAULT NULL,
  `browser` varchar(40) DEFAULT NULL,
  `is_bot` tinyint(1) NOT NULL DEFAULT 0,
  `user_agent` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_visitor_time` (`visited_at`),
  KEY `idx_visitor_ip_time` (`ip_address`, `visited_at`),
  KEY `idx_visitor_user_time` (`user_id`, `visited_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Page views for the security dashboard (90 days)';

-- ตำแหน่งของ IP (ค้นครั้งเดียวต่อ IP แล้วเก็บไว้ ใช้ทั้งผู้เข้าชมและบันทึกความปลอดภัย)
CREATE TABLE IF NOT EXISTS `ip_geo_cache` (
  `ip_address` varchar(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `network` varchar(10) NOT NULL COMMENT 'public | private | unknown',
  `country` varchar(8) DEFAULT NULL,
  `region` varchar(80) DEFAULT NULL,
  `city` varchar(80) DEFAULT NULL,
  `latitude` decimal(9,6) DEFAULT NULL,
  `longitude` decimal(9,6) DEFAULT NULL,
  `isp` varchar(120) DEFAULT NULL,
  `source` varchar(20) DEFAULT NULL COMMENT 'lookup | headers | private | failed',
  `looked_up_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ip_address`),
  KEY `idx_ip_geo_looked_up` (`looked_up_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Approximate IP location cache';
