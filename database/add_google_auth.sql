-- Migration: รองรับ Google OAuth / Gmail login
-- รันหลังจาก auth.sql, add_password_auth.sql และ add_facility_approval.sql

ALTER TABLE `users`
  ADD COLUMN `google_sub` VARCHAR(255) NULL DEFAULT NULL
    COMMENT 'Google OpenID Connect subject identifier'
    AFTER `thaid_cid`,
  ADD UNIQUE KEY `uk_users_google_sub` (`google_sub`);

SET @drop_identity_check = (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `users` DROP CHECK `chk_users_identity`',
    'SELECT 1'
  )
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'users'
    AND constraint_name = 'chk_users_identity'
);
PREPARE drop_identity_check_stmt FROM @drop_identity_check;
EXECUTE drop_identity_check_stmt;
DEALLOCATE PREPARE drop_identity_check_stmt;

ALTER TABLE `users`
  ADD CONSTRAINT `chk_users_identity`
    CHECK (`thaid_cid` IS NOT NULL OR `username` IS NOT NULL OR `google_sub` IS NOT NULL);
