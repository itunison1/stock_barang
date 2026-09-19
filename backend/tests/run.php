<?php
require __DIR__ . '/../api/lib.php';

$failures = 0;
function check(string $name, bool $cond): void {
    global $failures;
    echo ($cond ? "PASS " : "FAIL ") . $name . "\n";
    if (!$cond) $failures++;
}

$secret = 'unit-test-secret';

// --- token ---
$t = wms_make_token('kirana', 1700000000, $secret);
$p = wms_parse_token($t, $secret);
check('token roundtrip username', $p !== null && $p['username'] === 'kirana');
check('token roundtrip ts', $p !== null && $p['ts'] === 1700000000);
check('token wrong secret rejected', wms_parse_token($t, 'other') === null);
check('token tampered rejected', wms_parse_token($t . 'x', $secret) === null);
check('token garbage rejected', wms_parse_token('abc', $secret) === null);
check('token empty rejected', wms_parse_token('', $secret) === null);

// --- password ---
$hash = password_hash('rahasia', PASSWORD_DEFAULT);
check('password_hash ok', wms_verify_password('rahasia', $hash));
check('password_hash wrong', !wms_verify_password('salah', $hash));
check('null stored rejected', !wms_verify_password('x', null));
check('empty stored rejected', !wms_verify_password('x', ''));
$iv = hex2bin(md5('iv-seed'));
$legacy = openssl_encrypt('lama123', 'aes-256-cbc', 'legacy-key', 0, $iv);
check('legacy aes ok', wms_verify_password('lama123', $legacy, 'legacy-key', 'iv-seed'));
check('legacy aes wrong', !wms_verify_password('beda', $legacy, 'legacy-key', 'iv-seed'));
check('legacy disabled without key', !wms_verify_password('lama123', $legacy));

// --- waktu ---
check('device time iso z', wms_parse_device_time('2026-09-19T10:00:00Z') === 1789812000);
check('device time fractional', wms_parse_device_time('2026-09-19T10:00:00.123Z') === 1789812000);
check('device time garbage', wms_parse_device_time('bukan waktu') === null);
check('device time null', wms_parse_device_time(null) === null);

// --- uuid ---
check('uuid ok', wms_is_uuid('3f2b8c1e-5d4a-4c3b-9a1e-0123456789ab'));
check('uuid bad', !wms_is_uuid('123'));
check('uuid not string', !wms_is_uuid(123));

// --- validator count ---
$count = [
    'client_uuid' => '3f2b8c1e-5d4a-4c3b-9a1e-0123456789ab',
    'session_uuid' => '4f2b8c1e-5d4a-4c3b-9a1e-0123456789ab',
    'warehouse_code' => 'U2 GUDANG2', 'item_code' => 'AB6C50', 'item_name' => 'BAUT 3/8 x 50',
    'qty_system' => 8500, 'qty_physical' => 8400, 'variance' => -100,
    'rack_code' => null, 'note' => '', 'supersedes_uuid' => null,
    'created_at_device' => '2026-09-19T10:00:00Z',
];
check('count valid', wms_validate_count($count) === []);
$bad = $count; $bad['qty_physical'] = -1;
check('count negative qty rejected', wms_validate_count($bad) !== []);
$bad = $count; $bad['client_uuid'] = 'x';
check('count bad uuid rejected', wms_validate_count($bad) !== []);
$bad = $count; unset($bad['item_code']);
check('count missing item_code rejected', wms_validate_count($bad) !== []);
$bad = $count; $bad['qty_physical'] = '12abc';
check('count non numeric qty rejected', wms_validate_count($bad) !== []);
$ok = $count; $ok['qty_physical'] = '12';
check('count numeric string qty accepted', wms_validate_count($ok) === []);

// --- validator proposal ---
$prop = [
    'client_uuid' => '3f2b8c1e-5d4a-4c3b-9a1e-0123456789ab',
    'session_uuid' => '4f2b8c1e-5d4a-4c3b-9a1e-0123456789ab',
    'barcode' => '8992001001999', 'name' => 'BAUT BARU', 'category' => 'Baut',
    'proposed_qty' => '500', 'warehouse_code' => 'U2 GUDANG2', 'notes' => '',
    'created_at_device' => '2026-09-19T10:00:00Z',
    'photo_sha256' => str_repeat('a', 64),
];
check('proposal valid', wms_validate_proposal($prop) === []);
$bad = $prop; $bad['photo_sha256'] = 'zz';
check('proposal bad sha rejected', wms_validate_proposal($bad) !== []);
$bad = $prop; $bad['name'] = '  ';
check('proposal blank name rejected', wms_validate_proposal($bad) !== []);

// --- validator audit ---
$audit = [
    'client_uuid' => '3f2b8c1e-5d4a-4c3b-9a1e-0123456789ab',
    'action' => 'print', 'entity_type' => 'printer_socket', 'entity_uuid' => null,
    'description' => 'cetak label', 'detail_json' => null,
    'created_at_device' => '2026-09-19T10:00:00Z',
];
check('audit valid', wms_validate_audit($audit) === []);
$bad = $audit; $bad['action'] = '';
check('audit blank action rejected', wms_validate_audit($bad) !== []);

echo $failures === 0 ? "\nALL PASS\n" : "\n$failures FAILED\n";
exit($failures === 0 ? 0 : 1);
