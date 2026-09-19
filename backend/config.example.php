<?php
/* Salin jadi config.php di server (stock/config.php) dan isi. JANGAN commit config.php. */

define('WMS_DB_HOST', '192.168.1.140');   // host MySQL live, konfirmasi ke admin
define('WMS_DB_NAME', 'produksi');
define('WMS_DB_USER', 'usr_android');
define('WMS_DB_PASS', 'ISI_DI_SERVER');

// String acak panjang. Generate: php -r "echo bin2hex(random_bytes(32));"
define('WMS_TOKEN_SECRET', 'ISI_DI_SERVER');

// Opsional: dekripsi password lama (ciphertext AES) di user_produksi.
// Salin nilainya dari config.php MEview (fungsi decode()) bila masih ada baris lama.
// Biarkan null bila semua password sudah password_hash().
define('WMS_LEGACY_AES_KEY', null);
define('WMS_LEGACY_AES_IV_SEED', null);

// Opsional: nama kolom waktu-ubah di tabel item untuk delta sync. null = belum ada / belum diverifikasi.
define('WMS_ITEM_UPDATED_COLUMN', null);

// Folder foto proposal (harus writable oleh Apache).
define('WMS_UPLOAD_DIR', __DIR__ . '/uploads/proposals');
