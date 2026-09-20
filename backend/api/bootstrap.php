<?php
require_once __DIR__ . '/lib.php';

$wmsConfig = __DIR__ . '/../config.php';
if (!is_file($wmsConfig)) {
    wms_json_error('Server belum dikonfigurasi (config.php tidak ada).', 500);
}
require_once $wmsConfig;

mysqli_report(MYSQLI_REPORT_OFF);
$conn = @mysqli_connect(WMS_DB_HOST, WMS_DB_USER, WMS_DB_PASS, WMS_DB_NAME);
if (!$conn) {
    wms_json_error('Database tidak terjangkau.', 503);
}
mysqli_set_charset($conn, 'utf8mb4');

function wms_require_auth(mysqli $conn): array {
    $token = wms_bearer_token();
    if ($token === null) wms_json_error('Token tidak ditemukan. Silakan login ulang.', 401);
    $parsed = wms_parse_token($token, WMS_TOKEN_SECRET);
    if ($parsed === null) wms_json_error('Token tidak valid. Silakan login ulang.', 401);

    $stmt = $conn->prepare(
        "SELECT iduser, username, user_level, user_divisi, user_aktif FROM user_produksi WHERE LOWER(username) = ? LIMIT 1"
    );
    $lower = strtolower($parsed['username']);
    $stmt->bind_param('s', $lower);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) wms_json_error('User tidak ditemukan. Silakan login ulang.', 401);
    if ((int)$user['user_aktif'] !== 1) wms_json_error('Akun tidak aktif.', 403);
    return $user;
}

function wms_is_admin(array $user): bool {
    return (int)$user['user_level'] === 1;
}

function wms_require_admin(mysqli $conn): array {
    $user = wms_require_auth($conn);
    if (!wms_is_admin($user)) wms_json_error('Khusus administrator.', 403);
    return $user;
}

function wms_require_table(mysqli $conn, string $table): void {
    if (preg_match('/^[a-z_]+$/', $table) !== 1) wms_json_error('Nama tabel tidak valid.', 500);
    $r = @mysqli_query($conn, "SHOW TABLES LIKE '" . $table . "'");
    if ($r === false || mysqli_num_rows($r) === 0) {
        wms_json_error('Tabel ' . $table . ' belum dibuat. Jalankan migrations/wms_tables.sql.', 503);
    }
}
