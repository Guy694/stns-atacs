-- ==========================================================
-- seed_assets.sql  —  ข้อมูลทะเบียนทรัพย์สินสารสนเทศตัวอย่าง
-- 20 รายการ จาก 6 หน่วยงาน ครอบคลุม 5 อำเภอ
-- รันหลังจาก health_facilities.sql และ information_assets.sql
-- ==========================================================

-- ── 1. แบบสำรวจหัว (information_asset_surveys) ─────────────────────────
INSERT INTO `information_asset_surveys`
  (`id`, `facility_id`, `survey_title`, `personnel_count`, `survey_date`, `notes`)
VALUES
  (1, 65, 'ทะเบียนทรัพย์สินสารสนเทศ สสจ.สตูล ปี 2569',       92,  '2026-05-04', NULL),
  (2,  1, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.สตูล ปี 2569',         214, '2026-05-03', NULL),
  (3,  7, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.ละงู ปี 2569',          61,  '2026-05-02', NULL),
  (4,  2, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.ควนกาหลง ปี 2569',     78,  '2026-05-01', NULL),
  (5,  5, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.ทุ่งหว้า ปี 2569',     55,  '2026-04-28', NULL),
  (6,  6, 'ทะเบียนทรัพย์สินสารสนเทศ รพ.มะนัง ปี 2569',        43,  '2026-04-30', NULL);

-- ── 2. รายการทรัพย์สิน (information_assets) ────────────────────────────
INSERT INTO `information_assets` (
  `id`, `survey_id`, `row_no`,
  `asset_registration_no`, `asset_name`, `usage_description`,
  `owner_name`, `asset_category`, `asset_group`, `device_type`,
  `operating_system`, `private_ip`, `public_ip`, `location_detail`,
  `current_status`, `updated_by`,
  `manufacturer_brand`, `serial_number`,
  `maintenance_start_date`, `maintenance_end_date`
) VALUES

-- ── สสจ.สตูล (survey_id=1) ────────────────────────────────────────────
(1,  1, 1,
 'SAT-MOPH-HW-0001', 'Core Firewall',
 'ควบคุมการเข้าออกเครือข่ายส่วนกลางของจังหวัด',
 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Firewall',
 'FortiOS 7.4', '10.10.0.1', '203.113.10.5',
 'Data Corner ชั้น 2 อาคารอำนวยการ',
 'Active', 'Sa Admin',
 'Fortinet', 'FGT90G-SATUL-01',
 '2024-05-28', '2026-05-28'),

(2,  1, 2,
 'SAT-MOPH-SYS-0002', 'VM Host A',
 'รัน HIS, dashboard และระบบรายงานภายใน',
 'นางสาวสุชาดา ทองมาก', 'Software', 'System', 'Linux',
 'Ubuntu Server 24.04', '10.10.0.20', NULL,
 'Server Rack A1',
 'Active', 'NOC Satun',
 'Dell', 'DL-SATUL-A1',
 '2024-10-15', '2026-10-15'),

(3,  1, 3,
 'SAT-MOPH-NW-0003', 'Core Switch L3',
 'กระจายสัญญาณหลักระหว่าง VLAN ภายในสสจ.',
 'นายอิรฟาน หลงเด็น', 'Hardware', 'Network', 'Switch',
 'ArubaOS 10.x', '10.10.0.2', NULL,
 'Data Corner ชั้น 2 อาคารอำนวยการ',
 'Active', 'Sa Admin',
 'HP Aruba', 'ARB-5400-MOPH-01',
 '2024-12-31', '2026-12-31'),

(4,  1, 4,
 'SAT-MOPH-HW-0004', 'UPS ระบบกลาง',
 'สำรองไฟสำหรับห้อง Server และ Network ชั้น 2',
 'นางสาวสุชาดา ทองมาก', 'Hardware', 'Hardware', 'UPS',
 'Firmware (APC)', '-', NULL,
 'ห้อง Server ชั้น 2 อาคารอำนวยการ',
 'Active', 'Sa Admin',
 'APC', 'APC-SMART5K-MOPH-01',
 '2025-03-15', '2027-03-15'),

-- ── รพ.สตูล (survey_id=2) ──────────────────────────────────────────────
(5,  2, 1,
 'SAT-HOS-HW-0108', 'X-Ray Review Workstation',
 'เครื่องอ่านผลภาพถ่ายรังสี',
 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Hardware', 'Windows',
 'Windows 11 Pro', '172.16.8.21', NULL,
 'ห้อง X-Ray OPD',
 'Active', 'ศูนย์ IT รพ.สตูล',
 'HP', 'HPXR-8841',
 '2024-06-11', '2026-06-11'),

(6,  2, 2,
 'SAT-HOS-NW-0114', 'Radiology Switch',
 'กระจายสัญญาณห้องรังสีและ PACS',
 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Switch',
 'Embedded OS', '172.16.8.2', NULL,
 'Rack R2 ห้องรังสี',
 'Broken', 'Field Audit 2',
 'Cisco', 'CSW-RD-0114',
 '2024-05-19', '2026-05-19'),

(7,  2, 3,
 'SAT-HOS-SYS-0115', 'HIS Application Server',
 'ให้บริการระบบ HIS สำหรับแผนกทั้งหมดของโรงพยาบาล',
 'นายธีรพงศ์ ชูช่วย', 'Software', 'System', 'Linux',
 'CentOS 7', '172.16.1.10', NULL,
 'Server Rack หลัก ห้องสื่อสาร',
 'Active', 'ศูนย์ IT รพ.สตูล',
 'Dell', 'DL-HIS-SRV-HOSP-01',
 '2024-08-30', '2026-08-30'),

(8,  2, 4,
 'SAT-HOS-NW-0116', 'Internet Edge Router',
 'เชื่อมต่ออินเทอร์เน็ตหลักของโรงพยาบาล',
 'นายธีรพงศ์ ชูช่วย', 'Hardware', 'Network', 'Router',
 'RouterOS v7', '172.16.0.1', '49.228.110.20',
 'ห้องสื่อสาร ชั้น 1 อาคาร OPD',
 'Active', 'ศูนย์ IT รพ.สตูล',
 'MikroTik', 'MTK-RB1100-HOSP-01',
 '2024-11-20', '2026-11-20'),

-- ── รพ.ละงู (survey_id=3) ──────────────────────────────────────────────
(9,  3, 1,
 'SAT-LNG-ST-0203', 'NAS Backup Unit',
 'เก็บข้อมูลสำรองระบบห้องคลอดและการเงิน',
 'นางสาวอาซียะห์ ดอเลาะ', 'Hardware', 'Storage', 'NAS',
 'Synology DSM 7.2', '10.20.4.10', NULL,
 'ห้องแม่ข่าย ชั้น 1',
 'Inactive', 'ทีมสำรวจละงู',
 'Synology', 'SYN-0203-LNG',
 '2024-05-22', '2026-05-22'),

(10, 3, 2,
 'SAT-LNG-SYS-0204', 'AD Domain Controller',
 'จัดการสิทธิ์ผู้ใช้งานในเครือข่ายโรงพยาบาล',
 'นายวสันต์ นวลแก้ว', 'Software', 'System', 'Windows',
 'Windows Server 2022', '10.20.4.12', '1.20.130.44',
 'Server Rack B2',
 'Active', 'NOC Satun',
 'Lenovo', 'LNV-0204-DC',
 '2024-07-30', '2026-07-30'),

(11, 3, 3,
 'SAT-LNG-HW-0205', 'Network Laser Printer',
 'พิมพ์เอกสารทั่วไปและใบเสร็จรับเงินสำหรับแผนกเวชระเบียน',
 'นายวสันต์ นวลแก้ว', 'Hardware', 'Hardware', 'Printer',
 'Embedded OS', '10.20.4.50', NULL,
 'ห้องเวชระเบียน ชั้น 1',
 'Active', 'ทีมสำรวจละงู',
 'HP', 'HPP-LJP4015-LNG-01',
 '2025-01-10', '2027-01-10'),

-- ── รพ.ควนกาหลง (survey_id=4) ─────────────────────────────────────────
(12, 4, 1,
 'SAT-KLG-HW-0301', 'Firewall UTM',
 'ป้องกันเครือข่ายและกรองทราฟฟิคขาเข้า-ขาออกของโรงพยาบาล',
 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Firewall',
 'FortiOS 7.4', '192.168.1.1', '1.1.228.35',
 'Data Room ชั้น 1 อาคารอำนวยการ',
 'Active', 'ทีมสำรวจควนกาหลง',
 'Fortinet', 'FGT60F-KLG-01',
 '2024-09-15', '2026-09-15'),

(13, 4, 2,
 'SAT-KLG-NW-0302', 'Core Switch',
 'กระจายสัญญาณหลักระหว่างแผนกต่าง ๆ ภายในโรงพยาบาล',
 'นายกมล แซ่โค้ว', 'Hardware', 'Network', 'Switch',
 'Embedded OS', '192.168.1.2', NULL,
 'Data Room ชั้น 1 อาคารอำนวยการ',
 'Active', 'ทีมสำรวจควนกาหลง',
 'Cisco', 'CSW-KLG-C2960-01',
 '2024-06-05', '2026-06-05'),

(14, 4, 3,
 'SAT-KLG-HW-0303', 'OPD Workstation',
 'ใช้บันทึกข้อมูลผู้ป่วยนอกและออกใบสั่งยา',
 'นางสาวมาเรียม สาเรง', 'Hardware', 'Hardware', 'Windows',
 'Windows 10 Pro', '192.168.2.44', NULL,
 'ห้อง OPD ชั้น 1',
 'Broken', 'ทีมสำรวจควนกาหลง',
 'Lenovo', 'LNV-OPD-KLG-0303',
 '2024-01-01', '2025-12-31'),

-- ── รพ.ทุ่งหว้า (survey_id=5) ─────────────────────────────────────────
(15, 5, 1,
 'SAT-THW-NW-0401', 'Internet Router',
 'เชื่อมต่ออินเทอร์เน็ตผ่าน ISP และทำ NAT สำหรับเครือข่ายภายใน',
 'นายสมชาย หาดทิพย์', 'Hardware', 'Network', 'Router',
 'RouterOS v7', '10.30.0.1', '49.49.214.8',
 'ห้องสื่อสาร ชั้น 1',
 'Active', 'ทีมสำรวจทุ่งหว้า',
 'MikroTik', 'MTK-CCR1009-THW-01',
 '2024-07-20', '2026-07-20'),

(16, 5, 2,
 'SAT-THW-ST-0402', 'NAS Backup',
 'สำรองข้อมูล EMR และภาพถ่ายทางการแพทย์ทุกคืน',
 'นายสมชาย หาดทิพย์', 'Hardware', 'Storage', 'NAS',
 'Synology DSM 7.2', '10.30.0.20', NULL,
 'ห้อง Server ชั้น 2',
 'Inactive', 'ทีมสำรวจทุ่งหว้า',
 'Synology', 'SYN-DS923-THW-01',
 '2024-05-15', '2026-05-15'),

(17, 5, 3,
 'SAT-THW-SYS-0403', 'Antivirus Management Server',
 'บริหารจัดการ endpoint protection สำหรับเครื่องในโรงพยาบาลทั้งหมด',
 'นายสมชาย หาดทิพย์', 'Software', 'System', 'Windows',
 'Windows Server 2019', '10.30.0.30', NULL,
 'Server Rack ห้อง Server ชั้น 2',
 'Active', 'ทีมสำรวจทุ่งหว้า',
 'Dell', 'DL-PE340-AV-THW-01',
 '2024-10-01', '2026-10-01'),

-- ── รพ.มะนัง (survey_id=6) ────────────────────────────────────────────
(18, 6, 1,
 'SAT-MNG-NW-0501', 'Access Point Controller',
 'ควบคุมและกระจายสัญญาณ Wi-Fi ภายในอาคารรักษาพยาบาลทั้งหมด',
 'นายรุสดี สาและ', 'Hardware', 'Network', 'Access Point',
 'UniFi Network OS', '10.40.0.10', NULL,
 'ชั้น 1 อาคารรักษาพยาบาล',
 'Active', 'ทีมสำรวจมะนัง',
 'Ubiquiti', 'UAP-PRO-MNG-01',
 '2024-08-20', '2026-08-20'),

(19, 6, 2,
 'SAT-MNG-SYS-0502', 'Patient DB Server',
 'ฐานข้อมูลผู้ป่วยและประวัติการรักษาของโรงพยาบาลมะนัง',
 'นายรุสดี สาและ', 'Software', 'System', 'Linux',
 'Ubuntu Server 22.04 LTS', '10.40.0.20', NULL,
 'ห้อง Server ชั้น 1',
 'Active', 'ทีมสำรวจมะนัง',
 'HP', 'HPE-ML30-MNG-01',
 '2024-12-25', '2026-12-25'),

(20, 6, 3,
 'SAT-MNG-HW-0503', 'OPD Workstation 1',
 'ใช้บันทึกข้อมูลผู้ป่วยนอกแผนกอายุรกรรม',
 'นางสาวนิสา มาหะมะ', 'Hardware', 'Hardware', 'Windows',
 'Windows 11 Pro', '10.40.2.11', NULL,
 'ห้อง OPD แผนกอายุรกรรม',
 'Broken', 'ทีมสำรวจมะนัง',
 'Lenovo', 'LNV-OPD-MNG-0503',
 '2024-05-25', '2026-05-25');

-- ── ตรวจสอบผลลัพธ์ ─────────────────────────────────────────────────────
SELECT
  ia.id,
  hf.name             AS facility,
  hf.district_name    AS district,
  ia.asset_registration_no,
  ia.asset_name,
  ia.asset_category,
  ia.device_type,
  ia.current_status,
  ia.maintenance_end_date,
  DATEDIFF(ia.maintenance_end_date, CURDATE()) AS days_remaining
FROM information_assets ia
JOIN information_asset_surveys ias ON ias.id = ia.survey_id
JOIN health_facilities hf ON hf.id = ias.facility_id
ORDER BY ia.id;
