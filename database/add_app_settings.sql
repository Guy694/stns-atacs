-- เก็บค่า configuration ที่ผู้ดูแลระบบปรับจากหน้า Admin Settings

CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` varchar(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `setting_value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Application settings controlled from admin UI';
