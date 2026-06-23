ALTER TABLE users
  ADD COLUMN IF NOT EXISTS officer_position VARCHAR(150) NULL
    COMMENT 'ตำแหน่งงานของเจ้าหน้าที่'
    AFTER full_name;
