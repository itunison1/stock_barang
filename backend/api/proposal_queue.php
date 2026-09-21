<?php
require_once __DIR__ . '/bootstrap.php';
$user = wms_require_auth($conn);
if (!in_array((int)$user['user_level'], [1, 2], true)) wms_json_error('Khusus Admin atau Supervisor.', 403);
wms_require_table($conn, 'wms_proposals');

$status = isset($_GET['status']) ? trim((string)$_GET['status']) : 'pending';
$allowed = ['pending', 'active', 'rejected'];
if (!in_array($status, $allowed, true)) wms_json_error('status tidak valid.', 400);

$stmt = $conn->prepare(
    "SELECT client_uuid, username, barcode, name, category, proposed_qty, warehouse_code, notes,
        photo_file, status, rejection_reason, approved_by, approved_at, created_at_device, server_received_at
     FROM wms_proposals WHERE status = ? ORDER BY id DESC LIMIT 200"
);
$stmt->bind_param('s', $status);
$stmt->execute();
$res = $stmt->get_result();

$out = [];
while ($r = $res->fetch_assoc()) {
    $r['proposed_qty'] = (int)$r['proposed_qty'];
    $r['photo_url'] = '../uploads/proposals/' . rawurlencode($r['photo_file']);
    $out[] = $r;
}
$stmt->close();
wms_json_success($out);
