<?php
require_once __DIR__ . '/bootstrap.php';
$user = wms_require_auth($conn);
if (!in_array((int)$user['user_level'], [1, 2], true)) wms_json_error('Khusus Admin atau Supervisor.', 403);
wms_require_table($conn, 'wms_location_exceptions');

$status = isset($_GET['status']) ? trim((string)$_GET['status']) : '';
$allowed = ['REVIEW_REQUIRED', 'RECOUNT_REQUIRED', 'APPROVED_RETURN', 'APPROVED_TRANSFER', 'REJECTED'];

if ($status !== '' && !in_array($status, $allowed, true)) wms_json_error('status tidak valid.', 400);

if ($status === '') {
    $sql = "SELECT id, count_uuid, username, item_code, expected_warehouse, found_warehouse, rack_code,
        evidence_note, status, reviewed_by, reviewed_at, review_reason, created_at
        FROM wms_location_exceptions WHERE status IN ('REVIEW_REQUIRED','RECOUNT_REQUIRED') ORDER BY id DESC LIMIT 200";
    $stmt = $conn->prepare($sql);
} else {
    $sql = "SELECT id, count_uuid, username, item_code, expected_warehouse, found_warehouse, rack_code,
        evidence_note, status, reviewed_by, reviewed_at, review_reason, created_at
        FROM wms_location_exceptions WHERE status = ? ORDER BY id DESC LIMIT 200";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $status);
}
$stmt->execute();
$res = $stmt->get_result();

$out = [];
while ($r = $res->fetch_assoc()) {
    $r['id'] = (int)$r['id'];
    $out[] = $r;
}
$stmt->close();
wms_json_success($out);
