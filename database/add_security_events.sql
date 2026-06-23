-- Security events used for suspicious activity and brute-force detection.

CREATE TABLE IF NOT EXISTS `security_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_type` varchar(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ip_address` varchar(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `identity_value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_security_events_type_ip_created` (`event_type`, `ip_address`, `created_at`),
  KEY `idx_security_events_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Security events for anomaly and brute-force detection';
