/**
 * Konfigurasi Database & Server Akses PT Unison Industrial Indonesia
 * Sesuai data produksi internal MEviewer & parameter sistem.
 */

export const UNISON_DB_CONFIG = {
  company: {
    name: 'PT Unison Industrial Indonesia',
    shortName: 'PT Unison',
    specialty: 'Produsen & Distributor Fasteners Industri (Mur, Baut, Sekrup, Washer, & Anchor)',
    industry: 'Industrial Fasteners & Hardware Manufacturing',
    standard: 'DIN • JIS • ISO • ASTM',
    address: 'Kawasan Industri Cikarang / Bekasi, Jawa Barat',
  },

  // Server & Database Credentials (Production / Staging bridge)
  server: {
    host: '192.168.1.140', // Server database & MEview
    fallbackHost: '192.168.1.159',
    database: 'produksi',
    username: 'usr_android',
    password: 'zUNSprod',
    port: 3306,
  },

  // Remote Management Access
  remoteAccess: {
    ftp: {
      host: '192.168.1.140',
      port: 21,
      user: 'cseon',
      pass: '13371337',
    },
    rdp: {
      host: '192.168.1.140',
      port: 3389,
      user: 'cseon',
      pass: '3onsyst3m',
    },
  },

  // Daftar Resmi Gudang PT Unison Industrial Indonesia
  warehouses: [
    { id: 'WH-U2-G1', code: 'U2 GUDANG1', name: 'Gudang U2 - Unit 1', zone: 'Fastener Finishing', active: true },
    { id: 'WH-U2-G2', code: 'U2 GUDANG2', name: 'Gudang U2 - Unit 2', zone: 'Mur & Nut Processing', active: true },
    { id: 'WH-U2-G3', code: 'U2 GUDANG3', name: 'Gudang U2 - Unit 3', zone: 'Baut Hex & Socket Stock', active: true },
    { id: 'WH-U2-G4', code: 'U2 GUDANG4', name: 'Gudang U2 - Unit 4', zone: 'Stainless Steel Fasteners', active: true },
    { id: 'WH-U2-G5', code: 'U2 GUDANG5', name: 'Gudang U2 - Unit 5', zone: 'Plating & Galvanizing', active: true },
    { id: 'WH-U2-G6', code: 'U2 GUDANG6', name: 'Gudang U2 - Unit 6', zone: 'Heavy Stock & Bulk Packaging', active: true },
    { id: 'WH-U2-F29', code: 'U2 F29', name: 'Gudang U2 - Fasilitas 29', zone: 'Machining & Tapping', active: true },
    { id: 'WH-U2-UCP', code: 'U2 UCP', name: 'Gudang U2 - UCP', zone: 'Central Staging & QC', active: true },
    { id: 'WH-GJAYA', code: 'GUDANG JAYA', name: 'Gudang Jaya', zone: 'Warehouse Logistik Utama', active: true },
    { id: 'WH-D30', code: 'D30', name: 'Gudang D30', zone: 'Raw Materials & Wire Rod', active: true },
    { id: 'WH-U1', code: 'U1', name: 'Gudang U1', zone: 'Distribution & Finished Goods', active: true },
  ],
};
