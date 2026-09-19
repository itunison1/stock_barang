# WMS Backend API (PHP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endpoint PHP untuk app Android operator: login, master item, gudang, hitung, proposal (foto), audit, status proposal, plus tempat host `updates/`.

**Architecture:** Satu file PHP per endpoint di `backend/api/`, meniru pola MEview (`api/login.php`, `api/_auth.php`). Logika murni (token, password, validator) di `lib.php` dan diuji dengan skrip PHP biasa tanpa DB. Endpoint tulis idempoten lewat `client_uuid` + `UNIQUE KEY`. DB tidak bisa dites dari sesi ini, jadi endpoint hanya diverifikasi `php -l`.

**Tech Stack:** PHP 8 (XAMPP di `C:\xampp\php\php.exe`), mysqli prepared statements, MySQL/MariaDB.

**Spec:** [2026-09-19-android-native-operator-design.md](../specs/2026-09-19-android-native-operator-design.md) bagian 6, 7, 8, 9.

## Global Constraints

- Tidak ada kredensial di git. `backend/config.php` masuk `.gitignore`, hanya `config.example.php` yang ter-commit.
- Login **tidak menulis** ke `user_produksi` (tidak ada `active_token`, tidak ada upgrade hash).
- Semua tulis butuh token. Header `X-Auth-Token` (prioritas), `Authorization: Bearer` (cadangan).
- Semua respons JSON: sukses `{"success":true,"data":...}`, gagal `{"success":false,"message":"..."}` dengan kode HTTP sesuai.
- `usr_android` tidak punya CREATE TABLE. Tabel `wms_*` dibuat lewat `backend/migrations/wms_tables.sql` oleh admin. Sebelum migrasi jalan, endpoint tulis membalas HTTP 503.
- Tidak ada data karangan: `rack_code` dan `shelf_tier` tidak boleh dikirim server kecuali dari kolom DB nyata.
- Pesan error untuk operator berbahasa Indonesia.

## Kontrak payload (dipakai juga oleh plan Android)

`created_at_device`: string ISO-8601 UTC, contoh `2026-09-19T10:00:00.123Z`.
`client_uuid`, `session_uuid`, `supersedes_uuid`: UUID v4 huruf kecil.

| Endpoint | Method | Body / query | `data` sukses |
|---|---|---|---|
| `login.php` | POST JSON `{username,password,device}` | | `{token,iduser,username,user_divisi,user_level}` |
| `warehouses.php` | GET | | `[{code,name}]` urut `no_urut` |
| `master.php` | GET `after_id`,`limit`(≤5000, default 2000),`updated_since`(opsional) | | `{items:[{id,item_code,item_name,stock,unit,pack,isi_per_pack,warehouse_code}],next_after_id,done,server_time,supports_delta}` |
| `count.php` | POST JSON `{client_uuid,session_uuid,warehouse_code,item_code,item_name,qty_system,qty_physical,variance,rack_code,note,supersedes_uuid,created_at_device}` | | `{duplicate:bool}` |
| `proposal.php` | POST multipart: field `client_uuid,session_uuid,barcode,name,category,proposed_qty,warehouse_code,notes,created_at_device,photo_sha256` + file `photo` (JPEG ≤ 2 MB) | | `{duplicate:bool}` |
| `audit.php` | POST JSON `{client_uuid,action,entity_type,entity_uuid,description,detail_json,created_at_device}` | | `{duplicate:bool}` |
| `proposal_status.php` | GET | | `[{client_uuid,status,rejection_reason,approved_at}]` milik user token |

## File Structure

```
backend/
  config.example.php          konstanta DB, secret token, opsi legacy AES, kolom updated item
  api/lib.php                 fungsi murni (token, password, validator, waktu) + helper JSON
  api/bootstrap.php           load config, koneksi DB, wms_require_auth(), wms_require_table()
  api/login.php  warehouses.php  master.php  count.php  proposal.php  audit.php  proposal_status.php
  migrations/wms_tables.sql
  updates/version.json        template, contoh dokumen rilis
  updates/.htaccess           nonaktifkan eksekusi PHP
  uploads/.htaccess           nonaktifkan eksekusi PHP (folder foto proposal)
  tests/run.php               tes fungsi murni
  README.md                   deploy dan urutan rilis
```

---

### Task 1: lib.php dengan tes (token, password, validator)

**Files:**
- Create: `backend/api/lib.php`
- Create: `backend/tests/run.php`

**Interfaces:**
- Produces (dipakai semua endpoint):
  - `wms_make_token(string $username, int $ts, string $secret): string`
  - `wms_parse_token(string $token, string $secret): ?array` → `['username'=>string,'ts'=>int]` atau `null`
  - `wms_verify_password(string $plain, ?string $stored, ?string $legacyKey = null, ?string $legacyIvSeed = null): bool`
  - `wms_parse_device_time(?string $iso): ?int`
  - `wms_is_uuid(mixed $v): bool`
  - `wms_validate_count(array $b): array` (daftar pesan error, kosong = valid)
  - `wms_validate_proposal(array $b): array`
  - `wms_validate_audit(array $b): array`
  - `wms_json_success($data): never`, `wms_json_error(string $msg, int $code = 400): never`
  - `wms_bearer_token(): ?string`

- [ ] **Step 1: Tulis tes yang gagal**

Create `backend/tests/run.php`:

```php
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `/c/xampp/php/php.exe backend/tests/run.php`
Expected: fatal error `Failed opening required '.../lib.php'`.

- [ ] **Step 3: Implementasi minimal**

Create `backend/api/lib.php`:

```php
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
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `/c/xampp/php/php.exe backend/tests/run.php`
Expected: semua baris `PASS`, akhir `ALL PASS`, exit 0.
Bila tes `device time iso z` gagal karena timezone: nilai `1789812000` adalah 2026-09-19T10:00:00Z. Pastikan `date_default_timezone_set('UTC')` tidak diperlukan (suffix `Z` sudah eksplisit). Bila `fractional` gagal, ganti `wms_parse_device_time` memakai `DateTimeImmutable::createFromFormat` dan tambah tes; jangan hapus tesnya.

- [ ] **Step 5: Commit**

```bash
git add backend/api/lib.php backend/tests/run.php
git commit -m "feat(backend): add pure WMS lib (token, password, validators) with tests"
```

---

### Task 2: config.example, bootstrap, migrasi SQL, .gitignore

**Files:**
- Create: `backend/config.example.php`
- Create: `backend/api/bootstrap.php`
- Create: `backend/migrations/wms_tables.sql`
- Create: `backend/uploads/.htaccess`
- Modify: `.gitignore` (tambah baris di akhir)

**Interfaces:**
- Consumes: `wms_json_error`, `wms_bearer_token`, `wms_parse_token` dari Task 1.
- Produces:
  - `$conn` (mysqli) global setelah `require bootstrap.php`
  - `wms_require_auth(mysqli $conn): array` → baris `user_produksi` (`iduser`,`username`,`user_level`,`user_divisi`); mengakhiri request 401/403 bila gagal
  - `wms_require_table(mysqli $conn, string $table): void` → 503 bila tabel belum ada

- [ ] **Step 1: Buat `backend/config.example.php`**

```php
<?php
/* Salin jadi config.php di server (stock/config.php) dan isi. JANGAN commit config.php. */

define('WMS_DB_HOST', '192.168.1.140');   // host MySQL live, konfirmasi ke admin
define('WMS_DB_NAME', 'produksi');
define('WMS_DB_USER', 'usr_android');
define('WMS_DB_PASS', 'ISI_DI_SERVER');

// String acak panjang. Generate: php -r "echo bin2hex(random_bytes(32));"
define('WMS_TOKEN_SECRET', 'ISI_DI_SERVER');

// Opsional: dekripsi password lama (ciphertext AES) di user_produksi.
// Salin nilainya dari config.php MEview (fungsi decode()) bila masih ada baris lama.
// Biarkan null bila semua password sudah password_hash().
define('WMS_LEGACY_AES_KEY', null);
define('WMS_LEGACY_AES_IV_SEED', null);

// Opsional: nama kolom waktu-ubah di tabel item untuk delta sync. null = belum ada / belum diverifikasi.
define('WMS_ITEM_UPDATED_COLUMN', null);

// Folder foto proposal (harus writable oleh Apache).
define('WMS_UPLOAD_DIR', __DIR__ . '/uploads/proposals');
```

- [ ] **Step 2: Buat `backend/api/bootstrap.php`**

```php
<?php
require_once __DIR__ . '/lib.php';

$wmsConfig = __DIR__ . '/../config.php';
if (!is_file($wmsConfig)) {
    wms_json_error('Server belum dikonfigurasi (config.php tidak ada).', 500);
}
require_once $wmsConfig;

mysqli_report(MYSQLI_REPORT_OFF);
$conn = @mysqli_connect(WMS_DB_HOST, WMS_DB_USER, WMS_DB_PASS, WMS_DB_NAME);
if (!$conn) {
    wms_json_error('Database tidak terjangkau.', 503);
}
mysqli_set_charset($conn, 'utf8mb4');

function wms_require_auth(mysqli $conn): array {
    $token = wms_bearer_token();
    if ($token === null) wms_json_error('Token tidak ditemukan. Silakan login ulang.', 401);
    $parsed = wms_parse_token($token, WMS_TOKEN_SECRET);
    if ($parsed === null) wms_json_error('Token tidak valid. Silakan login ulang.', 401);

    $stmt = $conn->prepare(
        "SELECT iduser, username, user_level, user_divisi, user_aktif FROM user_produksi WHERE LOWER(username) = ? LIMIT 1"
    );
    $lower = strtolower($parsed['username']);
    $stmt->bind_param('s', $lower);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) wms_json_error('User tidak ditemukan. Silakan login ulang.', 401);
    if ((int)$user['user_aktif'] !== 1) wms_json_error('Akun tidak aktif.', 403);
    return $user;
}

function wms_require_table(mysqli $conn, string $table): void {
    if (preg_match('/^[a-z_]+$/', $table) !== 1) wms_json_error('Nama tabel tidak valid.', 500);
    $r = @mysqli_query($conn, "SHOW TABLES LIKE '" . $table . "'");
    if ($r === false || mysqli_num_rows($r) === 0) {
        wms_json_error('Tabel ' . $table . ' belum dibuat. Jalankan migrations/wms_tables.sql.', 503);
    }
}
```

- [ ] **Step 3: Buat `backend/migrations/wms_tables.sql`**

```sql
-- Jalankan sebagai akun DB yang punya CREATE TABLE (BUKAN usr_android).
-- Setelah itu pastikan usr_android punya SELECT, INSERT, UPDATE pada tabel wms_*:
--   GRANT SELECT, INSERT, UPDATE ON produksi.wms_counts    TO 'usr_android'@'%';
--   GRANT SELECT, INSERT, UPDATE ON produksi.wms_proposals TO 'usr_android'@'%';
--   GRANT SELECT, INSERT, UPDATE ON produksi.wms_audit_logs TO 'usr_android'@'%';

CREATE TABLE IF NOT EXISTS wms_counts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_uuid CHAR(36) NOT NULL,
  session_uuid CHAR(36) NOT NULL,
  username VARCHAR(50) NOT NULL,
  warehouse_code VARCHAR(50) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL DEFAULT '',
  qty_system DECIMAL(18,3) NOT NULL,
  qty_physical INT NOT NULL,
  variance DECIMAL(18,3) NOT NULL,
  rack_code VARCHAR(50) NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  supersedes_uuid CHAR(36) NULL,
  created_at_device DATETIME NOT NULL,
  server_received_at DATETIME NOT NULL,
  clock_skew_sec INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_counts_uuid (client_uuid),
  KEY idx_counts_user (username),
  KEY idx_counts_item (item_code),
  KEY idx_counts_wh (warehouse_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wms_proposals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_uuid CHAR(36) NOT NULL,
  session_uuid CHAR(36) NOT NULL,
  username VARCHAR(50) NOT NULL,
  barcode VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT '',
  proposed_qty INT NOT NULL DEFAULT 0,
  warehouse_code VARCHAR(50) NOT NULL,
  notes VARCHAR(500) NOT NULL DEFAULT '',
  photo_file VARCHAR(100) NOT NULL,
  photo_sha256 CHAR(64) NOT NULL,
  status ENUM('pending','active','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255) NULL,
  approved_by VARCHAR(50) NULL,
  approved_at DATETIME NULL,
  created_at_device DATETIME NOT NULL,
  server_received_at DATETIME NOT NULL,
  clock_skew_sec INT NOT NULL DEFAULT 0,
  clock_flag TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_proposals_uuid (client_uuid),
  KEY idx_proposals_user (username),
  KEY idx_proposals_status (status),
  KEY idx_proposals_barcode (barcode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wms_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_uuid CHAR(36) NOT NULL,
  username VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_uuid CHAR(36) NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  detail_json TEXT NULL,
  ip_address VARCHAR(45) NOT NULL DEFAULT '',
  created_at_device DATETIME NOT NULL,
  server_received_at DATETIME NOT NULL,
  UNIQUE KEY uq_audit_uuid (client_uuid),
  KEY idx_audit_user (username),
  KEY idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 4: Buat `backend/uploads/.htaccess`**

```apache
# Folder foto proposal: jangan pernah eksekusi PHP di sini.
RemoveHandler .php .phtml .php5
RemoveType .php .phtml .php5
php_flag engine off
Options -Indexes -ExecCGI
```

- [ ] **Step 5: Tambah ke `.gitignore`** (akhir file)

```
# Backend WMS
backend/config.php
backend/uploads/proposals/

# Android
android/local.properties
android/keystore.properties
android/keystore/
android/.gradle/
android/build/
android/app/build/
*.apk
```

- [ ] **Step 6: Verifikasi sintaks**

Run: `for f in backend/api/*.php backend/config.example.php; do /c/xampp/php/php.exe -l "$f"; done`
Expected: `No syntax errors detected` untuk tiap file.

- [ ] **Step 7: Commit**

```bash
git add backend .gitignore
git commit -m "feat(backend): add bootstrap, config example, wms tables migration"
```

---

### Task 3: login.php dan warehouses.php

**Files:**
- Create: `backend/api/login.php`
- Create: `backend/api/warehouses.php`

**Interfaces:**
- Consumes: `bootstrap.php` (`$conn`, `wms_require_auth`), `wms_verify_password`, `wms_make_token`, `wms_json_*`.
- Produces: respons sesuai tabel kontrak di atas.

- [ ] **Step 1: Buat `backend/api/login.php`**

```php
<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = $_POST;

$username = isset($body['username']) ? strtolower(trim((string)$body['username'])) : '';
$password = isset($body['password']) ? (string)$body['password'] : '';
if ($username === '' || $password === '') wms_json_error('Username dan password wajib diisi.', 400);

$stmt = $conn->prepare(
    "SELECT iduser, username, userpassword, user_divisi, user_level FROM user_produksi WHERE LOWER(username) = ? AND user_aktif = '1' LIMIT 1"
);
$stmt->bind_param('s', $username);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

$legacyKey = defined('WMS_LEGACY_AES_KEY') ? WMS_LEGACY_AES_KEY : null;
$legacyIv = defined('WMS_LEGACY_AES_IV_SEED') ? WMS_LEGACY_AES_IV_SEED : null;

if (!$user || !wms_verify_password($password, $user['userpassword'], $legacyKey, $legacyIv)) {
    usleep(300000); // perlambat tebakan password
    wms_json_error('Username atau password salah.', 401);
}

wms_json_success([
    'token' => wms_make_token($user['username'], time(), WMS_TOKEN_SECRET),
    'iduser' => (int)$user['iduser'],
    'username' => $user['username'],
    'user_divisi' => $user['user_divisi'],
    'user_level' => (int)$user['user_level'],
]);
```

- [ ] **Step 2: Buat `backend/api/warehouses.php`**

```php
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
```

- [ ] **Step 3: Verifikasi sintaks**

Run: `/c/xampp/php/php.exe -l backend/api/login.php && /c/xampp/php/php.exe -l backend/api/warehouses.php`
Expected: `No syntax errors detected` dua kali.

- [ ] **Step 4: Commit**

```bash
git add backend/api/login.php backend/api/warehouses.php
git commit -m "feat(backend): add login and warehouses endpoints"
```

---

### Task 4: master.php (sync master item, paged, gzip, delta opsional)

**Files:**
- Create: `backend/api/master.php`

**Interfaces:**
- Produces: `data = {items,next_after_id,done,server_time,supports_delta}`. `items[].stock` dan `isi_per_pack` bertipe angka; `warehouse_code` bisa `null` bila kolom `WCODE` kosong (jangan diisi tebakan).

- [ ] **Step 1: Buat `backend/api/master.php`**

```php
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
```

- [ ] **Step 2: Verifikasi sintaks**

Run: `/c/xampp/php/php.exe -l backend/api/master.php`
Expected: `No syntax errors detected`.

- [ ] **Step 3: Commit**

```bash
git add backend/api/master.php
git commit -m "feat(backend): add paged master item endpoint with optional delta"
```

---

### Task 5: count.php dan audit.php (idempoten)

**Files:**
- Create: `backend/api/count.php`
- Create: `backend/api/audit.php`

**Interfaces:**
- Consumes: `wms_validate_count`, `wms_validate_audit`, `wms_parse_device_time`, `wms_require_table`.
- Produces: `{duplicate:bool}`. Duplikat dideteksi lewat `UNIQUE KEY` + `ON DUPLICATE KEY UPDATE client_uuid = client_uuid` (affected_rows = 0).

- [ ] **Step 1: Buat `backend/api/count.php`**

```php
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
if (!$stmt->execute()) wms_json_error('Gagal menyimpan hitungan.', 500);
$duplicate = $stmt->affected_rows === 0;
$stmt->close();

wms_json_success(['duplicate' => $duplicate]);
```

- [ ] **Step 2: Buat `backend/api/audit.php`**

```php
<?php
require_once __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);
$user = wms_require_auth($conn);
wms_require_table($conn, 'wms_audit_logs');

$b = json_decode(file_get_contents('php://input'), true);
if (!is_array($b)) wms_json_error('Body JSON tidak valid.', 400);
$errors = wms_validate_audit($b);
if ($errors) wms_json_error(implode('; ', $errors), 422);

$deviceAt = gmdate('Y-m-d H:i:s', wms_parse_device_time($b['created_at_device']));
$clientUuid = $b['client_uuid'];
$username = $user['username'];
$action = $b['action'];
$entityType = $b['entity_type'];
$entityUuid = $b['entity_uuid'] ?? null;
$description = (string)($b['description'] ?? '');
$detail = $b['detail_json'] ?? null;
$ip = substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);

$stmt = $conn->prepare(
    "INSERT INTO wms_audit_logs (client_uuid, username, action, entity_type, entity_uuid, description,
        detail_json, ip_address, created_at_device, server_received_at)
     VALUES (?,?,?,?,?,?,?,?,?,NOW())
     ON DUPLICATE KEY UPDATE client_uuid = client_uuid"
);
if (!$stmt) wms_json_error('Gagal menyiapkan query.', 500);
$stmt->bind_param('sssssssss', $clientUuid, $username, $action, $entityType, $entityUuid, $description, $detail, $ip, $deviceAt);
if (!$stmt->execute()) wms_json_error('Gagal menyimpan audit.', 500);
$duplicate = $stmt->affected_rows === 0;
$stmt->close();

wms_json_success(['duplicate' => $duplicate]);
```

- [ ] **Step 3: Verifikasi sintaks**

Run: `/c/xampp/php/php.exe -l backend/api/count.php && /c/xampp/php/php.exe -l backend/api/audit.php`
Expected: `No syntax errors detected` dua kali.

- [ ] **Step 4: Commit**

```bash
git add backend/api/count.php backend/api/audit.php
git commit -m "feat(backend): add idempotent count and audit endpoints"
```

---

### Task 6: proposal.php (foto + hash + cek jam) dan proposal_status.php

**Files:**
- Create: `backend/api/proposal.php`
- Create: `backend/api/proposal_status.php`

**Interfaces:**
- Produces: `proposal.php` → `{duplicate:bool}`. Aturan: status selalu `pending` saat insert; foto wajib JPEG ≤ 2 MB; SHA-256 file harus sama dengan `photo_sha256`; `clock_flag=1` bila `|clock_skew_sec| > 300`; file disimpan `WMS_UPLOAD_DIR/{client_uuid}.jpg`.

- [ ] **Step 1: Buat `backend/api/proposal.php`**

```php
<?php
require_once __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') wms_json_error('Gunakan POST.', 405);
$user = wms_require_auth($conn);
wms_require_table($conn, 'wms_proposals');

$errors = wms_validate_proposal($_POST);
if ($errors) wms_json_error(implode('; ', $errors), 422);

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    wms_json_error('Foto wajib dilampirkan.', 422);
}
$file = $_FILES['photo'];
if ($file['size'] > 2 * 1024 * 1024) wms_json_error('Foto melebihi 2 MB.', 422);
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
if ($mime !== 'image/jpeg') wms_json_error('Foto harus JPEG.', 422);
if (!hash_equals($_POST['photo_sha256'], hash_file('sha256', $file['tmp_name']))) {
    wms_json_error('Hash foto tidak cocok, unggah ulang.', 422);
}

$clientUuid = $_POST['client_uuid'];

// Duplikat: bila sudah ada, jangan simpan ulang file.
$chk = $conn->prepare("SELECT 1 FROM wms_proposals WHERE client_uuid = ? LIMIT 1");
$chk->bind_param('s', $clientUuid);
$chk->execute();
$exists = $chk->get_result()->num_rows > 0;
$chk->close();
if ($exists) wms_json_success(['duplicate' => true]);

if (!is_dir(WMS_UPLOAD_DIR) && !@mkdir(WMS_UPLOAD_DIR, 0775, true)) {
    wms_json_error('Folder upload tidak bisa dibuat.', 500);
}
$photoFile = $clientUuid . '.jpg';
if (!move_uploaded_file($file['tmp_name'], WMS_UPLOAD_DIR . '/' . $photoFile)) {
    wms_json_error('Gagal menyimpan foto.', 500);
}

$deviceTs = wms_parse_device_time($_POST['created_at_device']);
$deviceAt = gmdate('Y-m-d H:i:s', $deviceTs);
$skew = time() - $deviceTs;
$flag = abs($skew) > 300 ? 1 : 0;

$sessionUuid = $_POST['session_uuid'];
$username = $user['username'];
$barcode = trim($_POST['barcode']);
$name = trim($_POST['name']);
$category = (string)($_POST['category'] ?? '');
$qty = (int)$_POST['proposed_qty'];
$warehouse = $_POST['warehouse_code'];
$notes = (string)($_POST['notes'] ?? '');
$sha = $_POST['photo_sha256'];

$stmt = $conn->prepare(
    "INSERT INTO wms_proposals (client_uuid, session_uuid, username, barcode, name, category, proposed_qty,
        warehouse_code, notes, photo_file, photo_sha256, status, created_at_device, server_received_at,
        clock_skew_sec, clock_flag)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?,NOW(),?,?)
     ON DUPLICATE KEY UPDATE client_uuid = client_uuid"
);
if (!$stmt) wms_json_error('Gagal menyiapkan query.', 500);
$stmt->bind_param(
    'ssssssisssssii',
    $clientUuid, $sessionUuid, $username, $barcode, $name, $category, $qty,
    $warehouse, $notes, $photoFile, $sha, $deviceAt, $skew, $flag
);
if (!$stmt->execute()) wms_json_error('Gagal menyimpan proposal.', 500);
$duplicate = $stmt->affected_rows === 0;
$stmt->close();

wms_json_success(['duplicate' => $duplicate]);
```

- [ ] **Step 2: Buat `backend/api/proposal_status.php`**

```php
<?php
require_once __DIR__ . '/bootstrap.php';
$user = wms_require_auth($conn);
wms_require_table($conn, 'wms_proposals');

$stmt = $conn->prepare(
    "SELECT client_uuid, status, rejection_reason, approved_at
     FROM wms_proposals WHERE username = ? ORDER BY id DESC LIMIT 500"
);
$stmt->bind_param('s', $user['username']);
$stmt->execute();
$res = $stmt->get_result();

$out = [];
while ($r = $res->fetch_assoc()) {
    $out[] = [
        'client_uuid' => $r['client_uuid'],
        'status' => $r['status'],
        'rejection_reason' => $r['rejection_reason'],
        'approved_at' => $r['approved_at'],
    ];
}
$stmt->close();
wms_json_success($out);
```

- [ ] **Step 3: Verifikasi sintaks**

Run: `/c/xampp/php/php.exe -l backend/api/proposal.php && /c/xampp/php/php.exe -l backend/api/proposal_status.php`
Expected: `No syntax errors detected` dua kali.

- [ ] **Step 4: Commit**

```bash
git add backend/api/proposal.php backend/api/proposal_status.php
git commit -m "feat(backend): add proposal upload (photo hash, clock skew flag) and status endpoints"
```

---

### Task 7: updates/ dan README deploy

**Files:**
- Create: `backend/updates/version.json`
- Create: `backend/updates/.htaccess`
- Create: `backend/README.md`

- [ ] **Step 1: `backend/updates/version.json`** (versi awal, sama dengan `versionCode` awal app)

```json
{
  "versionCode": 1,
  "versionName": "1.0",
  "apkFileName": "StockOpname-1.0.apk",
  "notes": "Rilis awal aplikasi Stock Opname operator.",
  "mandatory": false
}
```

- [ ] **Step 2: `backend/updates/.htaccess`**

```apache
# Folder update: hanya file statis (APK, version.json). Tanpa eksekusi PHP, tanpa daftar isi.
RemoveHandler .php .phtml
php_flag engine off
Options -Indexes
AddType application/vnd.android.package-archive .apk
```

- [ ] **Step 3: `backend/README.md`**

```markdown
# WMS Backend (PHP)

Target di server 192.168.1.140 (Apache/XAMPP), folder `stock/`:

    stock/config.php          dari config.example.php, JANGAN commit
    stock/api/*.php           isi folder backend/api/
    stock/uploads/            foto proposal (.htaccess dari backend/uploads/)
    stock/updates/            version.json + APK

Base URL app: `http://192.168.1.140/stock/api/` (dari LAN kantor jangan pakai IP publik: NAT hairpin timeout).

## Urutan pasang pertama
1. Admin DB menjalankan `migrations/wms_tables.sql` (akun berhak CREATE TABLE) dan GRANT ke `usr_android`.
2. Salin `config.example.php` jadi `config.php`, isi `WMS_DB_PASS` dan `WMS_TOKEN_SECRET`.
3. Upload isi `api/`, lalu tes: `curl http://192.168.1.140/stock/api/login.php` harus membalas JSON 405 "Gunakan POST."

## Tes lokal (tanpa DB)
    /c/xampp/php/php.exe backend/tests/run.php

## Rilis APK (urutan WAJIB)
1. Naikkan `versionCode`/`versionName` di `android/app/build.gradle.kts`.
2. `cd android && ./gradlew assembleRelease`.
3. Upload APK ke `stock/updates/StockOpname-<versi>.apk`.
4. `curl -sI http://192.168.1.140/stock/updates/StockOpname-<versi>.apk` harus 200.
5. **Baru** upload `stock/updates/version.json` yang naik. Bila terbalik, HP ditawari update yang APK-nya belum ada.
```

- [ ] **Step 4: Commit**

```bash
git add backend/updates backend/README.md
git commit -m "docs(backend): add updates folder template and deploy/release README"
```

---

### Task 8: Hentikan rack/shelf karangan di API lama

**Files:**
- Modify: `api.php` (dua tempat: blok `items` dan `item`)
- Modify: `public/api.php` (identik dengan `api.php`, terapkan perubahan sama)
- Modify: `server.js` (dua tempat)

Aturan spec bagian 12 no. 3: `rack_code` dan `shelf_tier` tidak boleh dikarang. UI web punya fallback tampilan sendiri (`'RAK-01'`, `'Tingkat 1'`) di [MobileTerminal.jsx](../../../src/components/mobile/MobileTerminal.jsx) dan [SupervisorDashboard.jsx](../../../src/components/dashboard/SupervisorDashboard.jsx). Itu prototipe web dan di luar plan ini. Yang dihentikan hanya karangan di sisi server.

- [ ] **Step 1: Ganti di `api.php` dan `public/api.php`** (ada 2 kemunculan tiap file, gunakan replace-all)

Cari:
```php
            'rack_code' => $r['WCODE'] ? "RAK-{$r['WCODE']}" : 'RAK-A-01',
            'shelf_tier' => 'Tingkat 2',
```
Ganti dengan:
```php
            'rack_code' => null,
            'shelf_tier' => null,
```
(Indentasi blok `item` dua spasi lebih dalam: sesuaikan, isi sama.)

- [ ] **Step 2: Ganti di `server.js`** (2 kemunculan)

Cari:
```js
      rack_code: r.WCODE ? `RAK-${r.WCODE}` : 'RAK-A-01',
      shelf_tier: 'Tingkat 2',
```
Ganti dengan:
```js
      rack_code: null,
      shelf_tier: null,
```
(Pada blok `item` indentasi lebih dalam: sama.)

- [ ] **Step 3: Verifikasi**

Run: `grep -n "RAK-A-01\|Tingkat 2" api.php public/api.php server.js`
Expected: tidak ada keluaran.
Run: `/c/xampp/php/php.exe -l api.php && /c/xampp/php/php.exe -l public/api.php && node --check server.js`
Expected: `No syntax errors detected` dua kali, `node --check` tanpa keluaran.

- [ ] **Step 4: Commit**

```bash
git add api.php public/api.php server.js
git commit -m "fix(api): stop fabricating rack_code/shelf_tier from WCODE"
```

---

## Self-Review

- **Spec coverage:** login (bag. 7) T3; sync_master + delta opsional (bag. 6) T4; count/proposal idempoten (bag. 5, 7) T5-T6; foto hash + skew (bag. 8) T6; migrasi + 503 (bag. 7) T2; update folder + urutan rilis (bag. 9) T7; tanpa data karangan (bag. 12.3) T8; CORS: endpoint baru tidak mengirim header CORS sama sekali (app native tidak butuh), jadi tidak ada `*`.
- **Placeholder scan:** hanya `ISI_DI_SERVER` di `config.example.php`, itu memang berkas contoh.
- **Konsistensi tipe:** nama fungsi `wms_*` sama di semua task; kolom payload sama dengan tabel kontrak dan kolom SQL.
- **Belum terverifikasi:** semua endpoint yang menyentuh DB (T3-T6) hanya lulus `php -l`. Query `wip_lokasi_m`, kolom `item`, dan `user_produksi` mengikuti kode yang sudah ada di repo (`api.php`, `server.js`) dan MEview, belum dijalankan ke DB.
