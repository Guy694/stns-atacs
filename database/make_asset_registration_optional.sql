-- Migration: allow assets without an asset registration number.
-- Empty form input is saved as NULL so the existing unique key can allow
-- multiple unregistered assets in the same survey.

ALTER TABLE `information_assets`
  MODIFY COLUMN `asset_registration_no` VARCHAR(100)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NULL DEFAULT NULL
    COMMENT 'เลขทะเบียนทรัพย์สินสารสนเทศ';

UPDATE `information_assets`
SET `asset_registration_no` = NULL
WHERE TRIM(COALESCE(`asset_registration_no`, '')) = '';
