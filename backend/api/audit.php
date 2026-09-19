<?php
require_once __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);
$user = wms_require_auth($conn);
wms_require_table($conn, 'wms_audit_logs');

$b = json_decode(file_get_contents('php://input'), true);
if (!is_array($b)) wms_json_error('Body JSON tidak valid.', 400);
$errors = wms_validate_audit($b);
if ($errors) wms_json_error(implode('; ', $errors), 422);

$deviceAt = gmdate('Y-m-d H:i:s', wms_parse_device_time($b['created_at_device']));
$clientUuid = $b['client_uuid'];
$username = $user['username'];
$action = $b['action'];
$entityType = $b['entity_type'];
$entityUuid = $b['entity_uuid'] ?? null;
$description = (string)($b['description'] ?? '');
$detail = $b['detail_json'] ?? null;
$ip = substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);

$stmt = $conn->prepare(
    "INSERT INTO wms_audit_logs (client_uuid, username, action, entity_type, entity_uuid, description,
        detail_json, ip_address, created_at_device, server_received_at)
     VALUES (?,?,?,?,?,?,?,?,?,NOW())
     ON DUPLICATE KEY UPDATE client_uuid = client_uuid"
);
if (!$stmt) wms_json_error('Gagal menyiapkan query.', 500);
$stmt->bind_param('sssssssss', $clientUuid, $username, $action, $entityType, $entityUuid, $description, $detail, $ip, $deviceAt);
if (!$stmt->execute()) wms_json_error('Gagal menyimpan audit.', 500);
$duplicate = $stmt->affected_rows === 0;
$stmt->close();

wms_json_success(['duplicate' => $duplicate]);
