SET @has_first_name := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'first_name'
);

SET @add_first_name_sql := IF(
  @has_first_name = 0,
  'ALTER TABLE users ADD COLUMN first_name VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL AFTER thaid_cid',
  'SELECT 1'
);
PREPARE stmt_add_first_name FROM @add_first_name_sql;
EXECUTE stmt_add_first_name;
DEALLOCATE PREPARE stmt_add_first_name;

SET @has_last_name := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'last_name'
);

SET @add_last_name_sql := IF(
  @has_last_name = 0,
  'ALTER TABLE users ADD COLUMN last_name VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL AFTER first_name',
  'SELECT 1'
);
PREPARE stmt_add_last_name FROM @add_last_name_sql;
EXECUTE stmt_add_last_name;
DEALLOCATE PREPARE stmt_add_last_name;

-- Backfill from legacy full_name when present.
SET @has_full_name := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'full_name'
);

SET @backfill_sql := IF(
  @has_full_name > 0,
  "UPDATE users
   SET
     first_name = COALESCE(NULLIF(first_name, ''), TRIM(SUBSTRING_INDEX(full_name, ' ', 1))),
     last_name = COALESCE(NULLIF(last_name, ''), TRIM(SUBSTRING(full_name, CHAR_LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 1)))
   WHERE full_name IS NOT NULL AND TRIM(full_name) <> ''",
  "SELECT 1"
);
PREPARE stmt_backfill FROM @backfill_sql;
EXECUTE stmt_backfill;
DEALLOCATE PREPARE stmt_backfill;

UPDATE users
SET
  first_name = COALESCE(NULLIF(TRIM(first_name), ''), 'ไม่ระบุชื่อ'),
  last_name = COALESCE(NULLIF(TRIM(last_name), ''), '-')
WHERE first_name IS NULL OR TRIM(first_name) = '' OR last_name IS NULL OR TRIM(last_name) = '';

ALTER TABLE users
  MODIFY COLUMN first_name VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  MODIFY COLUMN last_name VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;

SET @drop_full_name_sql := IF(
  @has_full_name > 0,
  'ALTER TABLE users DROP COLUMN full_name',
  'SELECT 1'
);
PREPARE stmt_drop FROM @drop_full_name_sql;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;
