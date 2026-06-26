-- migration: เพิ่มฟิลด์ราคา วันที่ซื้อ และเลขที่สัญญา/ใบสั่งซื้อ
-- สำหรับทะเบียนคุมทรัพย์สินสารสนเทศ
-- รันบน: information_assets

ALTER TABLE `information_assets`
  ADD COLUMN `purchase_price`    DECIMAL(15,2) DEFAULT NULL  COMMENT 'ราคาที่ซื้อ (บาท)'          AFTER `serial_number`,
  ADD COLUMN `purchase_date`     DATE          DEFAULT NULL  COMMENT 'วันที่ซื้อ/ได้รับมอบ'        AFTER `purchase_price`,
  ADD COLUMN `purchase_order_no` VARCHAR(100)  DEFAULT NULL  COMMENT 'เลขที่สัญญา/ใบสั่งซื้อ/PO'  AFTER `purchase_date`;
