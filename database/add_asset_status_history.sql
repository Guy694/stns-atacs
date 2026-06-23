-- ประวัติการอัปเดตสถานะรายทรัพย์สิน สำหรับหน้า QR/detail

CREATE TABLE IF NOT EXISTS `asset_status_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `from_status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `changed_by_user_id` int DEFAULT NULL,
  `changed_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asset_status_history_asset_changed` (`asset_id`, `changed_at`),
  CONSTRAINT `fk_asset_status_history_asset`
    FOREIGN KEY (`asset_id`) REFERENCES `information_assets` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
