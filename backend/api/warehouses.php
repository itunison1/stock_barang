<?php
require_once __DIR__ . '/bootstrap.php';
wms_require_auth($conn);

$r = @mysqli_query($conn, "SELECT kode, nama FROM wip_lokasi_m WHERE active = 1 ORDER BY no_urut ASC");
if ($r === false) wms_json_error('Gagal membaca daftar gudang.', 500);

$out = [];
while ($row = mysqli_fetch_assoc($r)) {
    $out[] = ['code' => $row['kode'], 'name' => $row['nama']];
}
wms_json_success($out);
