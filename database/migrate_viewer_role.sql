-- เพิ่ม role 'viewer' สำหรับผู้ใช้แบบอ่านอย่างเดียว
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('admin', 'officer', 'viewer')
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
  NOT NULL DEFAULT 'officer'
  COMMENT 'บทบาทผู้ใช้ (admin=ผู้ดูแล, officer=เจ้าหน้าที่, viewer=ผู้ดูเท่านั้น)';
