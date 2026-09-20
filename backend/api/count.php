<?php
require_once __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);
$user = wms_require_auth($conn);
wms_require_table($conn, 'wms_counts');

$b = json_decode(file_get_contents('php://input'), true);
if (!is_array($b)) wms_json_error('Body JSON tidak valid.', 400);
$errors = wms_validate_count($b);
if ($errors) wms_json_error(implode('; ', $errors), 422);

$deviceTs = wms_parse_device_time($b['created_at_device']);
$deviceAt = gmdate('Y-m-d H:i:s', $deviceTs);
$skew = time() - $deviceTs;

$clientUuid = $b['client_uuid'];
$sessionUuid = $b['session_uuid'];
$username = $user['username'];
$warehouse = $b['warehouse_code'];
$itemCode = $b['item_code'];
$itemName = (string)($b['item_name'] ?? '');
$qtySystem = (float)$b['qty_system'];
$qtyPhysical = (int)$b['qty_physical'];
$variance = (float)$b['variance'];
$rack = $b['rack_code'] ?? null;
$note = (string)($b['note'] ?? '');
$supersedes = $b['supersedes_uuid'] ?? null;
$exceptionType = strtoupper(trim((string)($b['exception_type'] ?? '')));
$expectedWarehouse = trim((string)($b['expected_warehouse'] ?? ''));
if ($exceptionType !== '' && $exceptionType !== 'MISPLACED') wms_json_error('exception_type tidak valid.', 422);
if ($exceptionType === 'MISPLACED' && ($expectedWarehouse === '' || $expectedWarehouse === $warehouse)) {
    wms_json_error('Lokasi sistem dan lokasi temuan wajib berbeda.', 422);
}

mysqli_begin_transaction($conn);
$stmt = $conn->prepare(
    "INSERT INTO wms_counts (client_uuid, session_uuid, username, warehouse_code, item_code, item_name,
        qty_system, qty_physical, variance, rack_code, note, supersedes_uuid,
        created_at_device, server_received_at, clock_skew_sec)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?)
     ON DUPLICATE KEY UPDATE client_uuid = client_uuid"
);
if (!$stmt) wms_json_error('Gagal menyiapkan query.', 500);
$stmt->bind_param(
    'ssssssdidssssi',
    $clientUuid, $sessionUuid, $username, $warehouse, $itemCode, $itemName,
    $qtySystem, $qtyPhysical, $variance, $rack, $note, $supersedes, $deviceAt, $skew
);
if (!$stmt->execute()) {
    mysqli_rollback($conn);
    wms_json_error('Gagal menyimpan hitungan.', 500);
}
$duplicate = $stmt->affected_rows === 0;
$stmt->close();

if (!$duplicate && $exceptionType === 'MISPLACED') {
    wms_require_table($conn, 'wms_location_exceptions');
    $ex = $conn->prepare(
        "INSERT INTO wms_location_exceptions
         (count_uuid, username, item_code, expected_warehouse, found_warehouse, rack_code, evidence_note, status, created_at)
         VALUES (?,?,?,?,?,?,?,'REVIEW_REQUIRED',NOW())"
    );
    $ex->bind_param('sssssss', $clientUuid, $username, $itemCode, $expectedWarehouse, $warehouse, $rack, $note);
    if (!$ex->execute()) {
        mysqli_rollback($conn);
        wms_json_error('Gagal mencatat exception salah lokasi.', 500);
    }
    $ex->close();
}
mysqli_commit($conn);

wms_json_success([
    'duplicate' => $duplicate,
    'status' => $exceptionType === 'MISPLACED' ? 'REVIEW_REQUIRED' : ($variance == 0.0 ? 'VERIFIED' : 'REVIEW_REQUIRED'),
    'exception_type' => $exceptionType !== '' ? $exceptionType : null,
]);
