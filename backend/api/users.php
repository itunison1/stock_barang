<?php
require_once __DIR__ . '/bootstrap.php';

$admin = wms_require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = [];
    $result = $conn->query("SELECT iduser, username, user_divisi, user_level, user_aktif FROM user_produksi ORDER BY username");
    while ($row = $result->fetch_assoc()) {
        $row['iduser'] = (int)$row['iduser'];
        $row['user_level'] = (int)$row['user_level'];
        $row['user_aktif'] = (int)$row['user_aktif'];
        $rows[] = $row;
    }
    wms_json_success($rows);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan GET atau POST.', 405);
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) wms_json_error('Body JSON tidak valid.', 400);

$username = strtolower(trim((string)($body['username'] ?? '')));
$password = (string)($body['password'] ?? '');
$division = trim((string)($body['user_divisi'] ?? ''));
$level = (int)($body['user_level'] ?? 0);
if (!preg_match('/^[a-z0-9._-]{3,50}$/', $username)) wms_json_error('Username 3-50 karakter: huruf kecil, angka, titik, garis.', 400);
if (strlen($password) < 8) wms_json_error('Password minimal 8 karakter.', 400);
if (!in_array($level, [1, 2, 3], true)) wms_json_error('Hak akses wajib Admin, Supervisor, atau Operator.', 400);
if (mb_strlen($division) > 100) wms_json_error('Divisi terlalu panjang.', 400);

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $conn->prepare("INSERT INTO user_produksi (username, userpassword, user_divisi, user_level, user_aktif) VALUES (?, ?, ?, ?, '1')");
$stmt->bind_param('sssi', $username, $hash, $division, $level);
if (!$stmt->execute()) {
    if ($stmt->errno === 1062) wms_json_error('Username sudah digunakan.', 409);
    wms_json_error('Gagal membuat akun.', 500);
}
$id = $stmt->insert_id;
$stmt->close();
wms_json_success(['iduser' => $id, 'username' => $username, 'user_divisi' => $division, 'user_level' => $level, 'user_aktif' => 1]);
