-- Prerequisites: information_assets with a unique/primary id index, add_asset_class.sql.
-- Additive, repeatable migration. Does not change legacy IT fields or asset IDs.
CREATE TABLE IF NOT EXISTS asset_subtypes (
  id INT NOT NULL AUTO_INCREMENT,
  asset_class VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_asset_subtype_name (asset_class, name),
  UNIQUE KEY uq_asset_subtype_class (id, asset_class),
  CONSTRAINT chk_subtype_class CHECK (asset_class IN ('Office','Medical','Vehicle','Building','Utility','Other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- One extension per asset and class. Retain prior-class details when reclassifying.
CREATE TABLE IF NOT EXISTS asset_extensions (
  asset_id INT NOT NULL,
  asset_class VARCHAR(60) NOT NULL,
  subtype_id INT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  details JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_id, asset_class),
  KEY idx_extension_subtype_class (subtype_id, asset_class),
  CONSTRAINT fk_extension_asset FOREIGN KEY (asset_id) REFERENCES information_assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_extension_subtype FOREIGN KEY (subtype_id, asset_class) REFERENCES asset_subtypes(id, asset_class) ON DELETE RESTRICT,
  CONSTRAINT chk_extension_class CHECK (asset_class IN ('Office','Medical','Vehicle','Building','Utility','Other')),
  CONSTRAINT chk_extension_version CHECK (schema_version = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO asset_subtypes (asset_class, name) VALUES
 ('Office','โต๊ะ'), ('Office','เก้าอี้'), ('Office','ตู้เก็บเอกสาร'),
 ('Medical','เครื่องตรวจวินิจฉัย'), ('Medical','เครื่องมือรักษา'), ('Medical','เครื่องมือห้องปฏิบัติการ'),
 ('Vehicle','รถยนต์'), ('Vehicle','รถพยาบาล'), ('Vehicle','รถจักรยานยนต์'),
 ('Building','อาคารสำนักงาน'), ('Building','อาคารบริการ'), ('Building','สิ่งปลูกสร้างอื่น'),
 ('Utility','ระบบไฟฟ้า'), ('Utility','ระบบประปา'), ('Utility','ระบบปรับอากาศ'),
 ('Other','ครุภัณฑ์อื่น')
ON DUPLICATE KEY UPDATE name = VALUES(name);
