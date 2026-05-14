ALTER TABLE users
  ADD COLUMN facility_id INT NULL AFTER role,
  ADD CONSTRAINT fk_users_facility FOREIGN KEY (facility_id) REFERENCES health_facilities(id) ON DELETE SET NULL ON UPDATE CASCADE;
