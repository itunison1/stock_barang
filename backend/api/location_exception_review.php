<?php
require_once __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);
$user = wms_require_auth($conn);
if (!in_array((int)$user['user_level'], [1, 2], true)) wms_json_error('Khusus Admin atau Supervisor.', 403);
wms_require_table($conn, 'wms_location_exceptions');

$b = json_decode(file_get_contents('php://input'), true);
if (!is_array($b)) wms_json_error('Body JSON tidak valid.', 400);

$id = (int)($b['id'] ?? 0);
if ($id <= 0) wms_json_error('id tidak valid.', 400);

$allowedStatuses = ['APPROVED_RETURN', 'APPROVED_TRANSFER', 'REJECTED', 'RECOUNT_REQUIRED'];
$status = strtoupper(trim((string)($b['status'] ?? '')));
if (!in_array($status, $allowedStatuses, true)) {
    wms_json_error('status wajib salah satu dari: ' . implode(', ', $allowedStatuses), 422);
}

$reason = trim((string)($b['reason'] ?? ''));
if (mb_strlen($reason) > 500) wms_json_error('Alasan terlalu panjang.', 422);

$stmt = $conn->prepare("SELECT id, status FROM wms_location_exceptions WHERE id = ? LIMIT 1");
$stmt->bind_param('i', $id);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$row) wms_json_error('Exception tidak ditemukan.', 404);
if (!in_array($row['status'], ['REVIEW_REQUIRED', 'RECOUNT_REQUIRED'], true)) {
    wms_json_error('Exception sudah diproses sebelumnya (status: ' . $row['status'] . ').', 409);
}

$stmt = $conn->prepare(
    "UPDATE wms_location_exceptions SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_reason = ? WHERE id = ?"
);
$stmt->bind_param('sssi', $status, $user['username'], $reason, $id);
if (!$stmt->execute()) wms_json_error('Gagal memperbarui exception.', 500);
$stmt->close();

wms_json_success([
    'id' => $id,
    'status' => $status,
    'reviewed_by' => $user['username'],
]);
