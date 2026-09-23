-- Run explicitly by DB administrator. Never run automatically when StockOpnameApi starts.
-- This migration creates only the two Stock Opname tables. Existing WIP registry/ledger
-- tables remain the source of truth for serials, handling units, current stock, and events.

CREATE TABLE IF NOT EXISTS wip_opname (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nomor           VARCHAR(30) NOT NULL,
    divisi          VARCHAR(10) NOT NULL,
    status          VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    started_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at       DATETIME NULL,
    device_name     VARCHAR(50) NOT NULL DEFAULT '',
    note            VARCHAR(255) NOT NULL DEFAULT '',
    UNIQUE KEY uq_wip_opname_nomor (nomor),
    INDEX idx_wip_opname_location_status (divisi, status),
    CONSTRAINT fk_wip_opname_location
        FOREIGN KEY (divisi) REFERENCES wip_lokasi_m(kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wip_opname_detail (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    opname_id           BIGINT UNSIGNED NOT NULL,
    client_request_id   CHAR(36) NOT NULL,
    entry_type          VARCHAR(20) NOT NULL,
    serial              VARCHAR(24) NULL,
    unit_id             BIGINT UNSIGNED NULL,
    itcode              CHAR(9) NULL,
    expected_divisi     VARCHAR(10) NULL,
    actual_divisi       VARCHAR(10) NOT NULL,
    result              VARCHAR(24) NOT NULL,
    qty_box             DECIMAL(10,2) NOT NULL DEFAULT 1,
    gross_kg            DECIMAL(10,2) NULL,
    tare_kg             DECIMAL(10,2) NULL,
    net_kg              DECIMAL(10,2) NULL,
    scanned_at          DATETIME NOT NULL,
    note                VARCHAR(255) NOT NULL DEFAULT '',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wip_opname_request (client_request_id),
    UNIQUE KEY uq_wip_opname_serial (opname_id, serial),
    INDEX idx_wip_opname_detail_result (opname_id, result),
    CONSTRAINT fk_wip_opname_detail_header
        FOREIGN KEY (opname_id) REFERENCES wip_opname(id),
    CONSTRAINT fk_wip_opname_detail_unit
        FOREIGN KEY (unit_id) REFERENCES wip_handling_unit(id),
    CONSTRAINT fk_wip_opname_detail_item
        FOREIGN KEY (itcode) REFERENCES ItemProduksi_m(itcode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
