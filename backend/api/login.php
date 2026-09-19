<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = $_POST;

$username = isset($body['username']) ? strtolower(trim((string)$body['username'])) : '';
$password = isset($body['password']) ? (string)$body['password'] : '';
if ($username === '' || $password === '') wms_json_error('Username dan password wajib diisi.', 400);

$stmt = $conn->prepare(
    "SELECT iduser, username, userpassword, user_divisi, user_level FROM user_produksi WHERE LOWER(username) = ? AND user_aktif = '1' LIMIT 1"
);
$stmt->bind_param('s', $username);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

$legacyKey = defined('WMS_LEGACY_AES_KEY') ? WMS_LEGACY_AES_KEY : null;
$legacyIv = defined('WMS_LEGACY_AES_IV_SEED') ? WMS_LEGACY_AES_IV_SEED : null;

if (!$user || !wms_verify_password($password, $user['userpassword'], $legacyKey, $legacyIv)) {
    usleep(300000); // perlambat tebakan password
    wms_json_error('Username atau password salah.', 401);
}

wms_json_success([
    'token' => wms_make_token($user['username'], time(), WMS_TOKEN_SECRET),
    'iduser' => (int)$user['iduser'],
    'username' => $user['username'],
    'user_divisi' => $user['user_divisi'],
    'user_level' => (int)$user['user_level'],
]);
