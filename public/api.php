<?php
/**
 * PT UNISON INDUSTRIAL INDONESIA — WMS API BRIDGE (PHP / Apache)
 * Database `produksi` MySQL di 192.168.1.159:3306 / 127.0.0.1:3306
 * Kredensial: usr_android / zUNSprod
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$db_host = '192.168.1.159';
$db_name = 'produksi';
$db_user = 'usr_android';
$db_pass = 'zUNSprod';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5
    ]);
} catch (Exception $e) {
    // Fallback to localhost if host is local machine
    try {
        $pdo = new PDO("mysql:host=127.0.0.1;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 5
        ]);
        $db_host = '127.0.0.1';
    } catch (Exception $e2) {
        http_response_code(500);
        echo json_encode(["status" => "ERROR", "connected" => false, "message" => $e2->getMessage()]);
        exit;
    }
}

$action = isset($_GET['action']) ? $_GET['action'] : 'status';

if ($action === 'status') {
    $stmtItems = $pdo->query("SELECT COUNT(*) as total_items FROM item");
    $totalItems = $stmtItems->fetchColumn();

    $stmtUsers = $pdo->query("SELECT COUNT(*) as total_users FROM user_produksi WHERE user_aktif = 1");
    $totalUsers = $stmtUsers->fetchColumn();

    echo json_encode([
        "status" => "ONLINE",
        "connected" => true,
        "host" => "$db_host:3306",
        "database" => $db_name,
        "user" => $db_user,
        "total_items" => (int)$totalItems,
        "total_users" => (int)$totalUsers,
        "timestamp" => date('c')
    ]);
    exit;
}

if ($action === 'items') {
    $q = isset($_GET['q']) ? trim($_GET['q']) : (isset($_GET['search']) ? trim($_GET['search']) : '');
    $limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 100) : 40;

    $sql = "SELECT id, ITCODE, ITNAME, STOCK, UNIT, PRICE, WCODE, PACK, ISI FROM item WHERE 1=1";
    $params = [];

    if (!empty($q)) {
        $sql .= " AND (ITCODE LIKE ? OR ITNAME LIKE ?)";
        $params[] = "%$q%";
        $params[] = "%$q%";
    }

    $sql .= " ORDER BY ITCODE ASC LIMIT $limit";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $mapped = array_map(function($r) {
        $name = $r['ITNAME'];
        $cat = 'Fasteners';
        if (stripos($name, 'MUR') !== false) $cat = 'Mur / Nut';
        else if (stripos($name, 'BAUT') !== false) $cat = 'Baut / Bolt';

        return [
            'id' => (int)$r['id'],
            'sku' => $r['ITCODE'],
            'barcode' => $r['ITCODE'],
            'name' => $r['ITNAME'],
            'category' => $cat,
            'stock_system' => (float)$r['STOCK'],
            'unit' => $r['UNIT'] ?: 'PCS',
            'pack' => $r['PACK'] ?: 'DUS',
            'isi_per_pack' => (float)($r['ISI'] ?: 1),
            'warehouse_code' => $r['WCODE'] ?: 'U2 GUDANG2',
            'rack_code' => $r['WCODE'] ? "RAK-{$r['WCODE']}" : 'RAK-A-01',
            'shelf_tier' => 'Tingkat 2',
            'status' => 'active',
            'price' => (float)$r['PRICE'],
            'is_live_db' => true
        ];
    }, $rows);

    echo json_encode(["success" => true, "count" => count($mapped), "data" => $mapped]);
    exit;
}

if ($action === 'warehouses') {
    $stmt = $pdo->query("SELECT kode, nama, active, type, packing_default FROM wip_lokasi_m WHERE active = 1 ORDER BY no_urut ASC");
    $rows = $stmt->fetchAll();
    echo json_encode(["success" => true, "count" => count($rows), "data" => $rows]);
    exit;
}

if ($action === 'item') {
    $code = isset($_GET['code']) ? trim($_GET['code']) : '';
    $stmt = $pdo->prepare("SELECT id, ITCODE, ITNAME, STOCK, UNIT, PRICE, WCODE, PACK, ISI FROM item WHERE ITCODE = ? OR ITNAME = ? LIMIT 1");
    $stmt->execute([$code, $code]);
    $r = $stmt->fetch();

    if ($r) {
        $name = $r['ITNAME'];
        $cat = 'Fasteners';
        if (stripos($name, 'MUR') !== false) $cat = 'Mur / Nut';
        else if (stripos($name, 'BAUT') !== false) $cat = 'Baut / Bolt';

        $item = [
            'id' => (int)$r['id'],
            'sku' => $r['ITCODE'],
            'barcode' => $r['ITCODE'],
            'name' => $r['ITNAME'],
            'category' => $cat,
            'stock_system' => (float)$r['STOCK'],
            'unit' => $r['UNIT'] ?: 'PCS',
            'pack' => $r['PACK'] ?: 'DUS',
            'isi_per_pack' => (float)($r['ISI'] ?: 1),
            'warehouse_code' => $r['WCODE'] ?: 'U2 GUDANG2',
            'rack_code' => $r['WCODE'] ? "RAK-{$r['WCODE']}" : 'RAK-A-01',
            'shelf_tier' => 'Tingkat 2',
            'status' => 'active',
            'price' => (float)$r['PRICE'],
            'is_live_db' => true
        ];
        echo json_encode(["success" => true, "found" => true, "item" => $item]);
    } else {
        echo json_encode(["success" => true, "found" => false, "message" => "Item tidak ditemukan"]);
    }
    exit;
}

echo json_encode(["status" => "ONLINE", "message" => "PT Unison WMS PHP API Bridge"]);
