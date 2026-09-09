-- Persistent deduplication for Telegram alerts, especially agent offline alerts.

CREATE TABLE IF NOT EXISTS `telegram_alert_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_key` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_telegram_alert_events_event_key` (`event_key`),
  KEY `idx_telegram_alert_events_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Event keys used to prevent duplicate Telegram alerts';
