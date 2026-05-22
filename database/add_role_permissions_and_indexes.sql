-- Role permission matrix and query performance indexes

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role ENUM('admin', 'officer', 'viewer') NOT NULL,
  permission_key VARCHAR(64) NOT NULL,
  is_allowed TINYINT(1) NOT NULL DEFAULT 0,
  updated_by VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_role_permission (role, permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO role_permissions (role, permission_key, is_allowed, updated_by)
VALUES
  ('admin', 'assets.view', 1, 'migration'),
  ('admin', 'assets.create', 1, 'migration'),
  ('admin', 'assets.update', 1, 'migration'),
  ('admin', 'assets.delete', 1, 'migration'),
  ('admin', 'assets.network.view', 1, 'migration'),
  ('admin', 'transfer.manage', 1, 'migration'),
  ('admin', 'disposal.manage', 1, 'migration'),
  ('admin', 'inspection.view', 1, 'migration'),
  ('admin', 'inspection.create', 1, 'migration'),
  ('admin', 'reports.view', 1, 'migration'),
  ('admin', 'audit.view', 1, 'migration'),
  ('admin', 'audit.export', 1, 'migration'),
  ('admin', 'users.manage', 1, 'migration'),
  ('admin', 'facilities.manage', 1, 'migration'),
  ('admin', 'device-types.manage', 1, 'migration'),
  ('admin', 'permissions.manage', 1, 'migration'),
  ('admin', 'agent.manage', 1, 'migration'),

  ('officer', 'assets.view', 1, 'migration'),
  ('officer', 'assets.create', 1, 'migration'),
  ('officer', 'assets.update', 1, 'migration'),
  ('officer', 'assets.delete', 1, 'migration'),
  ('officer', 'assets.network.view', 1, 'migration'),
  ('officer', 'transfer.manage', 1, 'migration'),
  ('officer', 'disposal.manage', 1, 'migration'),
  ('officer', 'inspection.view', 1, 'migration'),
  ('officer', 'inspection.create', 1, 'migration'),
  ('officer', 'reports.view', 1, 'migration'),
  ('officer', 'audit.view', 0, 'migration'),
  ('officer', 'audit.export', 0, 'migration'),
  ('officer', 'users.manage', 0, 'migration'),
  ('officer', 'facilities.manage', 0, 'migration'),
  ('officer', 'device-types.manage', 0, 'migration'),
  ('officer', 'permissions.manage', 0, 'migration'),
  ('officer', 'agent.manage', 1, 'migration'),

  ('viewer', 'assets.view', 1, 'migration'),
  ('viewer', 'assets.create', 0, 'migration'),
  ('viewer', 'assets.update', 0, 'migration'),
  ('viewer', 'assets.delete', 0, 'migration'),
  ('viewer', 'assets.network.view', 0, 'migration'),
  ('viewer', 'transfer.manage', 0, 'migration'),
  ('viewer', 'disposal.manage', 0, 'migration'),
  ('viewer', 'inspection.view', 1, 'migration'),
  ('viewer', 'inspection.create', 0, 'migration'),
  ('viewer', 'reports.view', 1, 'migration'),
  ('viewer', 'audit.view', 0, 'migration'),
  ('viewer', 'audit.export', 0, 'migration'),
  ('viewer', 'users.manage', 0, 'migration'),
  ('viewer', 'facilities.manage', 0, 'migration'),
  ('viewer', 'device-types.manage', 0, 'migration'),
  ('viewer', 'permissions.manage', 0, 'migration'),
  ('viewer', 'agent.manage', 0, 'migration')
ON DUPLICATE KEY UPDATE
  is_allowed = VALUES(is_allowed),
  updated_by = VALUES(updated_by),
  updated_at = CURRENT_TIMESTAMP;

-- Asset list/filter indexes
CREATE INDEX idx_assets_status ON information_assets (current_status);
CREATE INDEX idx_assets_category ON information_assets (asset_category);
CREATE INDEX idx_assets_device_type ON information_assets (device_type);
CREATE INDEX idx_assets_maintenance_end ON information_assets (maintenance_end_date);
CREATE INDEX idx_assets_name ON information_assets (asset_name);
CREATE INDEX idx_assets_registration ON information_assets (asset_registration_no);
CREATE INDEX idx_assets_serial ON information_assets (serial_number);
CREATE INDEX idx_surveys_facility ON information_asset_surveys (facility_id);

-- Audit search/export indexes
CREATE INDEX idx_audit_created_at ON audit_logs (created_at);
CREATE INDEX idx_audit_action_created ON audit_logs (action, created_at);
CREATE INDEX idx_audit_entity_created ON audit_logs (entity, created_at);
CREATE INDEX idx_audit_user_created ON audit_logs (user_name, created_at);
