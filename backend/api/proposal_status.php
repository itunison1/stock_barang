<?php
require_once __DIR__ . '/bootstrap.php';
$user = wms_require_auth($conn);
wms_require_table($conn, 'wms_proposals');

$stmt = $conn->prepare(
    "SELECT client_uuid, status, rejection_reason, approved_at
     FROM wms_proposals WHERE username = ? ORDER BY id DESC LIMIT 500"
);
$stmt->bind_param('s', $user['username']);
$stmt->execute();
$res = $stmt->get_result();

$out = [];
while ($r = $res->fetch_assoc()) {
    $out[] = [
        'client_uuid' => $r['client_uuid'],
        'status' => $r['status'],
        'rejection_reason' => $r['rejection_reason'],
        'approved_at' => $r['approved_at'],
    ];
}
$stmt->close();
wms_json_success($out);
