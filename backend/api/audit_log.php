<?php
require_once __DIR__ . '/bootstrap.php';
$user = wms_require_auth($conn);
if (!in_array((int)$user['user_level'], [1, 2], true)) wms_json_error('Khusus Admin atau Supervisor.', 403);
wms_require_table($conn, 'wms_audit_logs');

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
$limit = max(1, min($limit, 500));

$stmt = $conn->prepare(
    "SELECT client_uuid, username, action, entity_type, entity_uuid, description, ip_address,
        created_at_device, server_received_at
     FROM wms_audit_logs ORDER BY id DESC LIMIT ?"
);
$stmt->bind_param('i', $limit);
$stmt->execute();
$res = $stmt->get_result();

$out = [];
while ($r = $res->fetch_assoc()) {
    $out[] = $r;
}
$stmt->close();
wms_json_success($out);
