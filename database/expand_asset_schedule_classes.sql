-- Run after add_asset_extensions.sql. Repeatable; preserves existing assets, subtype IDs and inactive flags.
SET @drop_class_check = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE asset_subtypes DROP ', IF(VERSION() LIKE '%MariaDB%', 'CONSTRAINT ', 'CHECK '), 'chk_subtype_class'), 'SELECT 1') FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_subtypes' AND CONSTRAINT_NAME = 'chk_subtype_class');
PREPARE class_stmt FROM @drop_class_check;
EXECUTE class_stmt;
DEALLOCATE PREPARE class_stmt;
ALTER TABLE asset_subtypes ADD CONSTRAINT chk_subtype_class CHECK (asset_class IN ('PermanentBuilding','Structure','Office','Vehicle','Electrical','Advertising','Agricultural','Factory','Construction','Survey','Medical','Education','Kitchen','Sports','Music','Weapons','Field','Other','Intangible','Building','Utility'));

SET @drop_class_check = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE asset_extensions DROP ', IF(VERSION() LIKE '%MariaDB%', 'CONSTRAINT ', 'CHECK '), 'chk_extension_class'), 'SELECT 1') FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_extensions' AND CONSTRAINT_NAME = 'chk_extension_class');
PREPARE class_stmt FROM @drop_class_check;
EXECUTE class_stmt;
DEALLOCATE PREPARE class_stmt;
ALTER TABLE asset_extensions ADD CONSTRAINT chk_extension_class CHECK (asset_class IN ('PermanentBuilding','Structure','Office','Vehicle','Electrical','Advertising','Agricultural','Factory','Construction','Survey','Medical','Education','Kitchen','Sports','Music','Weapons','Field','Other','Intangible','Building','Utility'));

INSERT INTO asset_subtypes (asset_class, name) VALUES
 ('PermanentBuilding', 'อาคารถาวร'),
 ('Structure', 'อาคารชั่วคราว/โรงเรือน'),
 ('Structure', 'ใช้คอนกรีตเสริมเหล็กหรือโครงเหล็กเป็นส่วนประกอบหลัก'),
 ('Structure', 'ใช้ไม้หรือวัสดุอื่นเป็นส่วนประกอบหลัก'),
 ('Structure', 'งานต่อเติม'),
 ('Structure', 'งานปรับปรุง: ไม้/ไม้อัด'),
 ('Structure', 'งานปรับปรุง: แผ่นยิปซั่ม/ลามิเนต/วัสดุคงทนอื่น ๆ'),
 ('Office', 'ครุภัณฑ์สำนักงาน'),
 ('Office', 'ลิฟต์ กรณีเปลี่ยนแทน (บันทึกเป็นสินทรัพย์ย่อย)'),
 ('Vehicle', 'ครุภัณฑ์ยานพาหนะและขนส่ง'),
 ('Electrical', 'ครุภัณฑ์ไฟฟ้าและวิทยุ'),
 ('Electrical', 'เครื่องกำเนิดไฟฟ้า'),
 ('Advertising', 'ครุภัณฑ์โฆษณาและเผยแพร่'),
 ('Agricultural', 'เครื่องมือและอุปกรณ์'),
 ('Agricultural', 'เครื่องจักรกล'),
 ('Factory', 'เครื่องมือและอุปกรณ์'),
 ('Factory', 'เครื่องจักรกล'),
 ('Construction', 'เครื่องมือและอุปกรณ์'),
 ('Construction', 'เครื่องจักรกล'),
 ('Survey', 'ครุภัณฑ์สำรวจ'),
 ('Medical', 'ครุภัณฑ์วิทยาศาสตร์และการแพทย์'),
 ('Education', 'ครุภัณฑ์การศึกษา'),
 ('Kitchen', 'ครุภัณฑ์งานบ้านงานครัว'),
 ('Sports', 'ครุภัณฑ์กีฬา/กายภาพ'),
 ('Music', 'ครุภัณฑ์ดนตรี/นาฏศิลป์'),
 ('Weapons', 'ครุภัณฑ์อาวุธ'),
 ('Field', 'ครุภัณฑ์สนาม'),
 ('Other', 'ครุภัณฑ์อื่น'),
 ('Intangible', 'สินทรัพย์ไม่มีตัวตน')
ON DUPLICATE KEY UPDATE name = VALUES(name);
