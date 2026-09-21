<?php
require_once __DIR__ . '/bootstrap.php';
$user = wms_require_auth($conn);

$file = (string)($_GET['file'] ?? '');
if (!preg_match('/^[0-9a-f-]{36}\.jpg$/i', $file)) {
    http_response_code(400);
    exit('Nama file tidak valid.');
}
$path = WMS_UPLOAD_DIR . '/' . $file;
if (!is_file($path)) {
    http_response_code(404);
    exit('Foto tidak ditemukan.');
}
header('Content-Type: image/jpeg');
header('Cache-Control: private, max-age=86400');
readfile($path);
