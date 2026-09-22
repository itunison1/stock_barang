<?php
/* label_resolve.php — resolusi serial LABEL KARUNG WIP + LOT Gudang Apps untuk Stock Opname.
 * GET /stock/api/label_resolve.php?serial=K00004AV  (wajib token, lihat wms_require_auth)
 * 200: ditemukan -> data label (serial, itcode, status, spnum, sp_sequence) / data lot
 *      (barcode, fp_itcode, itcode, item_name, isi, isidos, pack, unit, last_printed)
 * 400: format tidak valid
 * 404: serial/lot tidak ada
 * Dua format didukung:
 *  - Label karung WIP: char(8), K + 7 alnum (data .159: 100% row lolos ^K[A-Z0-9]{7}$)
 *  - Lot Gudang Apps (FoxPro .149): 8-12 alnum, diresolusi lewat snapshot fp_lot_map
 *    (impor LBLGDNG/LBL_OLD: BATCH -> ITCODE FoxPro -> CODE9 -> ITCODE MySQL produksi).
 */
require_once __DIR__ . '/bootstrap.php';
wms_require_auth($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') wms_json_error('Gunakan GET.', 405);

$serial = isset($_GET['serial']) ? strtoupper(trim((string)$_GET['serial'])) : '';
if ($serial === '') wms_json_error('Parameter serial wajib diisi. Contoh: ?serial=K00004AV', 400);
$isKSerial = preg_match('/^K[A-Z0-9]{7}$/', $serial) === 1;
$isLot = preg_match('/^[A-Z0-9-]{7,14}$/', $serial) === 1;
if (!$isKSerial && !$isLot) {
    wms_json_error('Format tidak valid. Label karung: K + 7 karakter (K00004AV). Lot Gudang Apps: 7-14 karakter alfanumerik/hubung (contoh 9CM36I810J, 8DB39FA-GJ).', 400);
}

if ($isKSerial) {
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
}

// Lot Gudang Apps: snapshot fp_lot_map (opsional — tabel boleh belum ada).
$check = $conn->query("SHOW TABLES LIKE 'fp_lot_map'");
if ($check === false || $check->num_rows === 0) {
    wms_json_error('Lot Gudang Apps tidak ditemukan (snapshot fp_lot_map belum tersedia): ' . $serial, 404);
}
$stmt = $conn->prepare(
    'SELECT barcode, fp_itcode, fp_itname, mysql_itcode, mysql_itname, isi, isidos, pack, unit, last_printed, qty
     FROM fp_lot_map WHERE barcode = ? LIMIT 1'
);
$stmt->bind_param('s', $serial);
$stmt->execute();
$lot = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$lot) wms_json_error('Lot Gudang Apps tidak ditemukan: ' . $serial, 404);

wms_json_success([
    'type' => 'lot_gudang',
    'serial' => $serial,
    'barcode' => $lot['barcode'],
    'fp_itcode' => $lot['fp_itcode'],
    'itcode' => $lot['mysql_itcode'] !== '' ? $lot['mysql_itcode'] : $lot['fp_itcode'],
    'item_name' => $lot['mysql_itname'] !== '' ? $lot['mysql_itname'] : $lot['fp_itname'],
    'isi' => $lot['isi'] !== '' && is_numeric($lot['isi']) ? (int)$lot['isi'] : null,
    'isidos' => $lot['isidos'] !== '' && is_numeric($lot['isidos']) ? (int)$lot['isidos'] : null,
    'pack' => $lot['pack'],
    'unit' => $lot['unit'],
    'last_printed' => $lot['last_printed'],
    'qty' => $lot['qty'] !== '' && is_numeric($lot['qty']) ? (int)$lot['qty'] : null,
]);
