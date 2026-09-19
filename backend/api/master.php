<?php
require_once __DIR__ . '/bootstrap.php';
wms_require_auth($conn);

if (function_exists('ob_gzhandler')) ob_start('ob_gzhandler');

$afterId = isset($_GET['after_id']) ? max(0, (int)$_GET['after_id']) : 0;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 2000;
$limit = max(1, min($limit, 5000));

$deltaCol = defined('WMS_ITEM_UPDATED_COLUMN') ? WMS_ITEM_UPDATED_COLUMN : null;
if ($deltaCol !== null && preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $deltaCol) !== 1) {
    wms_json_error('WMS_ITEM_UPDATED_COLUMN tidak valid.', 500);
}
$updatedSince = isset($_GET['updated_since']) ? trim($_GET['updated_since']) : '';

$sql = "SELECT id, ITCODE, ITNAME, STOCK, UNIT, PACK, ISI, WCODE FROM item WHERE id > ?";
$types = 'i';
$args = [$afterId];
if ($deltaCol !== null && $updatedSince !== '') {
    $sql .= " AND `$deltaCol` > ?";
    $types .= 's';
    $args[] = $updatedSince;
}
$sql .= " ORDER BY id ASC LIMIT ?";
$types .= 'i';
$args[] = $limit + 1; // +1 untuk mendeteksi masih ada halaman berikutnya

$stmt = $conn->prepare($sql);
if (!$stmt) wms_json_error('Gagal menyiapkan query item.', 500);
$stmt->bind_param($types, ...$args);
$stmt->execute();
$res = $stmt->get_result();

$items = [];
while ($r = $res->fetch_assoc()) {
    $items[] = [
        'id' => (int)$r['id'],
        'item_code' => $r['ITCODE'],
        'item_name' => $r['ITNAME'],
        'stock' => (float)$r['STOCK'],
        'unit' => $r['UNIT'],
        'pack' => $r['PACK'],
        'isi_per_pack' => $r['ISI'] === null ? null : (float)$r['ISI'],
        'warehouse_code' => ($r['WCODE'] === null || $r['WCODE'] === '') ? null : $r['WCODE'],
    ];
}
$stmt->close();

$done = count($items) <= $limit;
if (!$done) array_pop($items);
$next = $items ? $items[count($items) - 1]['id'] : $afterId;

wms_json_success([
    'items' => $items,
    'next_after_id' => $next,
    'done' => $done,
    'server_time' => date('Y-m-d H:i:s'),
    'supports_delta' => $deltaCol !== null,
]);
