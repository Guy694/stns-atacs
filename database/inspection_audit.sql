-- ── Inspection rounds ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_inspections (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  facility_id     INT NOT NULL,
  round_name      VARCHAR(120) NOT NULL COMMENT 'ชื่อรอบการตรวจนับ เช่น ตรวจนับ Q1/2569',
  inspected_by    VARCHAR(120) NOT NULL,
  inspected_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note            TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Per-asset inspection items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_inspection_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  inspection_id   INT NOT NULL,
  asset_id        INT NOT NULL,
  found           TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=พบ, 0=ไม่พบ',
  condition_note  VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspection_id) REFERENCES asset_inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id)      REFERENCES information_assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Audit log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  user_name   VARCHAR(120) NULL,
  action      ENUM('create','update','delete','transfer','dispose','inspect') NOT NULL,
  entity      VARCHAR(60)  NOT NULL COMMENT 'ตาราง เช่น information_assets',
  entity_id   INT          NULL,
  summary     TEXT         NULL COMMENT 'คำอธิบายการเปลี่ยนแปลง',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
