-- Migration: support encrypted Thai CID at rest (application-level encryption)
--
-- Notes:
-- - `thaid_cid` is expanded to VARCHAR(255) for encrypted payload.
-- - `thaid_cid_hash` stores HMAC-SHA256 for lookup/uniqueness.
-- - Existing plaintext values are left as-is; application auto-upgrades records on successful ThaiD login.

ALTER TABLE `users`
  MODIFY COLUMN `thaid_cid` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL
    COMMENT 'เลขบัตรประชาชนจากการยืนยันตัวตนผ่าน ThaiD (เข้ารหัส) (NULL = user ประเภท username/password เท่านั้น)';

SET @has_thaid_hash := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'thaid_cid_hash'
);

SET @add_thaid_hash_sql := IF(
  @has_thaid_hash = 0,
  "ALTER TABLE users ADD COLUMN thaid_cid_hash CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT 'ค่า HMAC-SHA256 ของเลข ThaiD สำหรับค้นหา/ตรวจซ้ำ' AFTER thaid_cid",
  'SELECT 1'
);
PREPARE stmt_add_thaid_hash FROM @add_thaid_hash_sql;
EXECUTE stmt_add_thaid_hash;
DEALLOCATE PREPARE stmt_add_thaid_hash;

SET @has_old_thaid_unique_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'uk_users_thaid_cid'
);

SET @drop_old_thaid_unique_idx_sql := IF(
  @has_old_thaid_unique_idx > 0,
  'ALTER TABLE users DROP INDEX uk_users_thaid_cid',
  'SELECT 1'
);
PREPARE stmt_drop_old_thaid_idx FROM @drop_old_thaid_unique_idx_sql;
EXECUTE stmt_drop_old_thaid_idx;
DEALLOCATE PREPARE stmt_drop_old_thaid_idx;

SET @has_thaid_hash_unique_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'uk_users_thaid_cid_hash'
);

SET @add_thaid_hash_unique_idx_sql := IF(
  @has_thaid_hash_unique_idx = 0,
  'ALTER TABLE users ADD UNIQUE KEY uk_users_thaid_cid_hash (thaid_cid_hash)',
  'SELECT 1'
);
PREPARE stmt_add_thaid_hash_idx FROM @add_thaid_hash_unique_idx_sql;
EXECUTE stmt_add_thaid_hash_idx;
DEALLOCATE PREPARE stmt_add_thaid_hash_idx;
