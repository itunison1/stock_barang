<?php
require_once __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);
$user = wms_require_auth($conn);
if (!in_array((int)$user['user_level'], [1, 2], true)) wms_json_error('Khusus Admin atau Supervisor.', 403);
wms_require_table($conn, 'wms_proposals');

$b = json_decode(file_get_contents('php://input'), true);
if (!is_array($b)) wms_json_error('Body JSON tidak valid.', 400);

$clientUuid = (string)($b['client_uuid'] ?? '');
if (!wms_is_uuid($clientUuid)) wms_json_error('client_uuid tidak valid.', 400);

$decision = strtolower(trim((string)($b['decision'] ?? '')));
if (!in_array($decision, ['approve', 'reject'], true)) wms_json_error('decision harus approve atau reject.', 422);

$reason = trim((string)($b['reason'] ?? ''));
if ($decision === 'reject' && $reason === '') wms_json_error('Alasan penolakan wajib diisi.', 422);
if (mb_strlen($reason) > 255) wms_json_error('Alasan terlalu panjang (maks 255 karakter).', 422);

$stmt = $conn->prepare("SELECT id, status FROM wms_proposals WHERE client_uuid = ? LIMIT 1");
$stmt->bind_param('s', $clientUuid);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$row) wms_json_error('Proposal tidak ditemukan.', 404);
if ($row['status'] !== 'pending') wms_json_error('Proposal sudah diproses sebelumnya (status: ' . $row['status'] . ').', 409);

if ($decision === 'approve') {
    $stmt = $conn->prepare(
        "UPDATE wms_proposals SET status = 'active', approved_by = ?, approved_at = NOW(), rejection_reason = NULL WHERE client_uuid = ?"
    );
    $stmt->bind_param('ss', $user['username'], $clientUuid);
} else {
    $stmt = $conn->prepare(
        "UPDATE wms_proposals SET status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_reason = ? WHERE client_uuid = ?"
    );
    $stmt->bind_param('sss', $user['username'], $reason, $clientUuid);
}
if (!$stmt->execute()) wms_json_error('Gagal memperbarui proposal.', 500);
$stmt->close();

wms_json_success([
    'client_uuid' => $clientUuid,
    'status' => $decision === 'approve' ? 'active' : 'rejected',
    'approved_by' => $user['username'],
]);
