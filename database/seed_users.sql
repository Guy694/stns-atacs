-- ==========================================================
-- seed_users.sql  —  ข้อมูล user ตัวอย่างสำหรับ ATACS
-- สร้างจาก scripts/generate-seed-users.mjs
-- วันที่สร้าง: 2026-05-11T08:30:27.053Z
--
-- ⚠️  ไฟล์นี้มีรหัสผ่าน plaintext อยู่ใน comment
--     ห้ามนำขึ้น production โดยไม่เปลี่ยนรหัสผ่าน
-- ==========================================================

-- รันหลังจาก auth.sql และ add_password_auth.sql แล้วเท่านั้น

INSERT INTO `users`
  (`thaid_cid`, `full_name`, `email`, `username`, `password_hash`, `role`, `is_active`)
VALUES
  -- [ADMIN] admin — ThaiD + username/password | password: Admin@2026
  ('3901900015481', 'อิรฟาน หลงเด็น', 'irfan.admin@satun.moph.go.th', 'atacs_admin', 'de195e10198461c169bc3a488fd7b3e0:9adc7e636748aa8c6ffb5462e97b3b4d3cf45841b91156e966b43ce0057ae3067d912e27d36c597cb085e81e98be87cb057a0aa5866634719dc0a2bd11347255', 'admin', 1),
  -- [OFFICER] officer — ThaiD เท่านั้น
  ('3900600012345', 'สุชาดา ทองมาก', 'suchada.officer@satun.moph.go.th', NULL, NULL, 'officer', 1),
  -- [OFFICER] officer — username/password เท่านั้น | password: Officer@2026
  (NULL, 'นครินทร์ ชายสิทธิ์', 'nakharin.officer@satun.moph.go.th', 'nakharin', 'd6299d396393d346b280ca7ce3c32ccc:a90a60d4287f66a88c9e5fb08b788b4b12dd3122fc08684320ecfbedd3392c4ff2d065a0f41a2b943168d085697adfefbff12ec931345857c8b8f3bdfa2c593c', 'officer', 1),
  -- [OFFICER] officer — ThaiD + username/password (ไม่มี email) | password: Staff@2026
  ('1901900088812', 'ธนพล รัตนะ', NULL, 'thanaphon.r', 'f66a5feeeab628babfdeb63449c656a2:f613edc5424966ad8f44e1cf3660dd46d4b2dc72c63eeb06433a5c564f2a2532066a923ce1e91e4c14fe0e9fd6d3db21ef2b1207016999f64b3089ed834dcd30', 'officer', 1);

-- ตรวจสอบผลลัพธ์
SELECT id, thaid_cid, full_name, email, username,
       IF(password_hash IS NOT NULL, 'SET', 'NONE') AS pwd_status,
       role, is_active
FROM users
ORDER BY id;
