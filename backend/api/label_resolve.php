<?php
/* label_resolve.php — resolusi serial LABEL KARUNG WIP untuk Stock Opname.
 * GET /stock/api/label_resolve.php?serial=K00004AV  (wajib token, lihat wms_require_auth)
 * 200: serial ditemukan -> data label (serial, itcode, status, spnum, sp_sequence)
 * 400: format serial tidak valid
 * 404: serial tidak ada di snapshot wip_label
 * Catatan: regex format mengikuti data aktual wip_label (char(8), K + 7 alnum;
 * 100% row lolos ^K[A-Z0-9]{7}$), bukan ^K[0-9]{6}[A-Z]$ di proposal awal
 * (hanya cocok 21% data, contoh resmi K00004AV pun tidak lolos regex itu).
 */
require_once __DIR__ . '/bootstrap.php';
wms_require_auth($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') wms_json_error('Gunakan GET.', 405);

$serial = isset($_GET['serial']) ? strtoupper(trim((string)$_GET['serial'])) : '';
if ($serial === '') wms_json_error('Parameter serial wajib diisi. Contoh: ?serial=K00004AV', 400);
if (preg_match('/^K[A-Z0-9]{7}$/', $serial) !== 1) {
    wms_json_error('Format serial label karung tidak valid. Serial terdiri dari K + 7 karakter alfanumerik, contoh: K00004AV.', 400);
}

wms_require_table($conn, 'wip_label');

$stmt = $conn->prepare(
    'SELECT serial, itcode, status, spnum, sp_sequence FROM wip_label WHERE serial = ? LIMIT 1'
);
$stmt->bind_param('s', $serial);
$stmt->execute();
$label = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$label) wms_json_error('Serial label karung tidak ditemukan: ' . $serial, 404);

wms_json_success([
    'type' => 'label_karung',
    'serial' => $label['serial'],
    'itcode' => $label['itcode'],
    'status' => $label['status'],
    'spnum' => $label['spnum'] !== null ? (int)$label['spnum'] : null,
    'sp_sequence' => $label['sp_sequence'] !== null ? (int)$label['sp_sequence'] : null,
]);
