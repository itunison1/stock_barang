<?php
/* Fungsi murni + helper JSON untuk WMS API. Tidak menyentuh DB. */

function wms_b64url_encode(string $s): string {
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function wms_b64url_decode(string $s): string|false {
    return base64_decode(strtr($s, '-_', '+/'), true);
}

/** Token stateless: base64url("username|ts") . "." . hmac-sha256. Tanpa tabel token. */
function wms_make_token(string $username, int $ts, string $secret): string {
    $payload = wms_b64url_encode($username . '|' . $ts);
    return $payload . '.' . hash_hmac('sha256', $payload, $secret);
}

function wms_parse_token(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') return null;
    if (!hash_equals(hash_hmac('sha256', $parts[0], $secret), $parts[1])) return null;
    $decoded = wms_b64url_decode($parts[0]);
    if ($decoded === false) return null;
    $pieces = explode('|', $decoded, 2);
    if (count($pieces) !== 2 || $pieces[0] === '' || (int)$pieces[1] <= 0) return null;
    return ['username' => $pieces[0], 'ts' => (int)$pieces[1]];
}

/** Baca-saja. password_hash baru, atau ciphertext AES lama bila $legacyKey diberikan. */
function wms_verify_password(string $plain, ?string $stored, ?string $legacyKey = null, ?string $legacyIvSeed = null): bool {
    if ($stored === null || $stored === '') return false;
    if (password_verify($plain, $stored)) return true;
    if ($legacyKey === null || $legacyIvSeed === null) return false;
    $iv = hex2bin(md5($legacyIvSeed));
    $legacy = @openssl_decrypt($stored, 'aes-256-cbc', $legacyKey, 0, $iv);
    return $legacy !== false && hash_equals($legacy, $plain);
}

function wms_parse_device_time(?string $iso): ?int {
    if ($iso === null || trim($iso) === '') return null;
    $ts = strtotime($iso);
    return $ts === false ? null : $ts;
}

function wms_is_uuid(mixed $v): bool {
    return is_string($v)
        && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $v) === 1;
}

function wms_str_ok(mixed $v, int $max, bool $required): bool {
    if ($v === null || $v === '') return !$required;
    if (!is_string($v)) return false;
    if ($required && trim($v) === '') return false;
    return mb_strlen($v) <= $max;
}

function wms_int_ok(mixed $v, int $min, int $max): bool {
    if (is_int($v)) return $v >= $min && $v <= $max;
    if (is_string($v) && preg_match('/^-?\d+$/', $v)) return (int)$v >= $min && (int)$v <= $max;
    return false;
}

function wms_validate_count(array $b): array {
    $e = [];
    if (!wms_is_uuid($b['client_uuid'] ?? null)) $e[] = 'client_uuid tidak valid';
    if (!wms_is_uuid($b['session_uuid'] ?? null)) $e[] = 'session_uuid tidak valid';
    if (!wms_str_ok($b['warehouse_code'] ?? null, 50, true)) $e[] = 'warehouse_code wajib';
    if (!wms_str_ok($b['item_code'] ?? null, 50, true)) $e[] = 'item_code wajib';
    if (!wms_str_ok($b['item_name'] ?? null, 255, false)) $e[] = 'item_name tidak valid';
    if (!is_numeric($b['qty_system'] ?? null)) $e[] = 'qty_system harus angka';
    if (!wms_int_ok($b['qty_physical'] ?? null, 0, 100000000)) $e[] = 'qty_physical harus bilangan bulat >= 0';
    if (!is_numeric($b['variance'] ?? null)) $e[] = 'variance harus angka';
    if (!wms_str_ok($b['rack_code'] ?? null, 50, false)) $e[] = 'rack_code tidak valid';
    if (!wms_str_ok($b['note'] ?? null, 500, false)) $e[] = 'note terlalu panjang';
    $sup = $b['supersedes_uuid'] ?? null;
    if ($sup !== null && !wms_is_uuid($sup)) $e[] = 'supersedes_uuid tidak valid';
    if (wms_parse_device_time($b['created_at_device'] ?? null) === null) $e[] = 'created_at_device tidak valid';
    return $e;
}

function wms_validate_proposal(array $b): array {
    $e = [];
    if (!wms_is_uuid($b['client_uuid'] ?? null)) $e[] = 'client_uuid tidak valid';
    if (!wms_is_uuid($b['session_uuid'] ?? null)) $e[] = 'session_uuid tidak valid';
    if (!wms_str_ok($b['barcode'] ?? null, 100, true)) $e[] = 'barcode wajib';
    if (!wms_str_ok($b['name'] ?? null, 255, true)) $e[] = 'name wajib';
    if (!wms_str_ok($b['category'] ?? null, 100, false)) $e[] = 'category tidak valid';
    if (!wms_int_ok($b['proposed_qty'] ?? null, 0, 100000000)) $e[] = 'proposed_qty harus bilangan bulat >= 0';
    if (!wms_str_ok($b['warehouse_code'] ?? null, 50, true)) $e[] = 'warehouse_code wajib';
    if (!wms_str_ok($b['notes'] ?? null, 500, false)) $e[] = 'notes terlalu panjang';
    if (wms_parse_device_time($b['created_at_device'] ?? null) === null) $e[] = 'created_at_device tidak valid';
    $sha = $b['photo_sha256'] ?? null;
    if (!is_string($sha) || preg_match('/^[0-9a-f]{64}$/', $sha) !== 1) $e[] = 'photo_sha256 tidak valid';
    return $e;
}

function wms_validate_audit(array $b): array {
    $e = [];
    if (!wms_is_uuid($b['client_uuid'] ?? null)) $e[] = 'client_uuid tidak valid';
    if (!wms_str_ok($b['action'] ?? null, 50, true)) $e[] = 'action wajib';
    if (!wms_str_ok($b['entity_type'] ?? null, 50, true)) $e[] = 'entity_type wajib';
    $eu = $b['entity_uuid'] ?? null;
    if ($eu !== null && !wms_is_uuid($eu)) $e[] = 'entity_uuid tidak valid';
    if (!wms_str_ok($b['description'] ?? null, 500, false)) $e[] = 'description terlalu panjang';
    if (!wms_str_ok($b['detail_json'] ?? null, 4000, false)) $e[] = 'detail_json terlalu panjang';
    if (wms_parse_device_time($b['created_at_device'] ?? null) === null) $e[] = 'created_at_device tidak valid';
    return $e;
}

function wms_json_success($data): never {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function wms_json_error(string $message, int $code = 400): never {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function wms_bearer_token(): ?string {
    if (isset($_SERVER['HTTP_X_AUTH_TOKEN']) && trim($_SERVER['HTTP_X_AUTH_TOKEN']) !== '') {
        return trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/i', $auth, $m)) return $m[1];
    return null;
}
