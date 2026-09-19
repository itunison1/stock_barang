-- Jalankan sebagai akun DB yang punya CREATE TABLE (BUKAN usr_android).
-- Setelah itu pastikan usr_android punya SELECT, INSERT, UPDATE pada tabel wms_*:
--   GRANT SELECT, INSERT, UPDATE ON produksi.wms_counts    TO 'usr_android'@'%';
--   GRANT SELECT, INSERT, UPDATE ON produksi.wms_proposals TO 'usr_android'@'%';
--   GRANT SELECT, INSERT, UPDATE ON produksi.wms_audit_logs TO 'usr_android'@'%';

CREATE TABLE IF NOT EXISTS wms_counts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_uuid CHAR(36) NOT NULL,
  session_uuid CHAR(36) NOT NULL,
  username VARCHAR(50) NOT NULL,
  warehouse_code VARCHAR(50) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL DEFAULT '',
  qty_system DECIMAL(18,3) NOT NULL,
  qty_physical INT NOT NULL,
  variance DECIMAL(18,3) NOT NULL,
  rack_code VARCHAR(50) NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  supersedes_uuid CHAR(36) NULL,
  created_at_device DATETIME NOT NULL,
  server_received_at DATETIME NOT NULL,
  clock_skew_sec INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_counts_uuid (client_uuid),
  KEY idx_counts_user (username),
  KEY idx_counts_item (item_code),
  KEY idx_counts_wh (warehouse_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wms_proposals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_uuid CHAR(36) NOT NULL,
  session_uuid CHAR(36) NOT NULL,
  username VARCHAR(50) NOT NULL,
  barcode VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT '',
  proposed_qty INT NOT NULL DEFAULT 0,
  warehouse_code VARCHAR(50) NOT NULL,
  notes VARCHAR(500) NOT NULL DEFAULT '',
  photo_file VARCHAR(100) NOT NULL,
  photo_sha256 CHAR(64) NOT NULL,
  status ENUM('pending','active','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255) NULL,
  approved_by VARCHAR(50) NULL,
  approved_at DATETIME NULL,
  created_at_device DATETIME NOT NULL,
  server_received_at DATETIME NOT NULL,
  clock_skew_sec INT NOT NULL DEFAULT 0,
  clock_flag TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_proposals_uuid (client_uuid),
  KEY idx_proposals_user (username),
  KEY idx_proposals_status (status),
  KEY idx_proposals_barcode (barcode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wms_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_uuid CHAR(36) NOT NULL,
  username VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_uuid CHAR(36) NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  detail_json TEXT NULL,
  ip_address VARCHAR(45) NOT NULL DEFAULT '',
  created_at_device DATETIME NOT NULL,
  server_received_at DATETIME NOT NULL,
  UNIQUE KEY uq_audit_uuid (client_uuid),
  KEY idx_audit_user (username),
  KEY idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
