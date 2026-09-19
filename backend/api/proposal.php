<?php
require_once __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);
$user = wms_require_auth($conn);
wms_require_table($conn, 'wms_proposals');

$errors = wms_validate_proposal($_POST);
if ($errors) wms_json_error(implode('; ', $errors), 422);

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    wms_json_error('Foto wajib dilampirkan.', 422);
}
$file = $_FILES['photo'];
if ($file['size'] > 2 * 1024 * 1024) wms_json_error('Foto melebihi 2 MB.', 422);
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
if ($mime !== 'image/jpeg') wms_json_error('Foto harus JPEG.', 422);
if (!hash_equals($_POST['photo_sha256'], hash_file('sha256', $file['tmp_name']))) {
    wms_json_error('Hash foto tidak cocok, unggah ulang.', 422);
}

$clientUuid = $_POST['client_uuid'];

// Duplikat: bila sudah ada, jangan simpan ulang file.
$chk = $conn->prepare("SELECT 1 FROM wms_proposals WHERE client_uuid = ? LIMIT 1");
$chk->bind_param('s', $clientUuid);
$chk->execute();
$exists = $chk->get_result()->num_rows > 0;
$chk->close();
if ($exists) wms_json_success(['duplicate' => true]);

if (!is_dir(WMS_UPLOAD_DIR) && !@mkdir(WMS_UPLOAD_DIR, 0775, true)) {
    wms_json_error('Folder upload tidak bisa dibuat.', 500);
}
$photoFile = $clientUuid . '.jpg';
if (!move_uploaded_file($file['tmp_name'], WMS_UPLOAD_DIR . '/' . $photoFile)) {
    wms_json_error('Gagal menyimpan foto.', 500);
}

$deviceTs = wms_parse_device_time($_POST['created_at_device']);
$deviceAt = gmdate('Y-m-d H:i:s', $deviceTs);
$skew = time() - $deviceTs;
$flag = abs($skew) > 300 ? 1 : 0;

$sessionUuid = $_POST['session_uuid'];
$username = $user['username'];
$barcode = trim($_POST['barcode']);
$name = trim($_POST['name']);
$category = (string)($_POST['category'] ?? '');
$qty = (int)$_POST['proposed_qty'];
$warehouse = $_POST['warehouse_code'];
$notes = (string)($_POST['notes'] ?? '');
$sha = $_POST['photo_sha256'];

$stmt = $conn->prepare(
    "INSERT INTO wms_proposals (client_uuid, session_uuid, username, barcode, name, category, proposed_qty,
        warehouse_code, notes, photo_file, photo_sha256, status, created_at_device, server_received_at,
        clock_skew_sec, clock_flag)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?,NOW(),?,?)
     ON DUPLICATE KEY UPDATE client_uuid = client_uuid"
);
if (!$stmt) wms_json_error('Gagal menyiapkan query.', 500);
$stmt->bind_param(
    'ssssssisssssii',
    $clientUuid, $sessionUuid, $username, $barcode, $name, $category, $qty,
    $warehouse, $notes, $photoFile, $sha, $deviceAt, $skew, $flag
);
if (!$stmt->execute()) wms_json_error('Gagal menyimpan proposal.', 500);
$duplicate = $stmt->affected_rows === 0;
$stmt->close();

wms_json_success(['duplicate' => $duplicate]);
