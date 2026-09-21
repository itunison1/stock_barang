<?php
/**
 * PT UNISON INDUSTRIAL INDONESIA â€” WMS API BRIDGE (PHP / Apache)
 * Primary: 127.0.0.1 (.140) | Fallback: 192.168.1.159
 * Database: produksi | User: usr_android
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); exit;
}

// â”€â”€ session_token: bridge PHP session â†’ bearer token untuk React supervisor app â”€â”€
if (isset($_GET['action']) && $_GET['action'] === 'session_token') {
    session_start();
    if (empty($_SESSION['wms_user'])) {
        echo json_encode(['success' => false, 'message' => 'Tidak ada sesi aktif']);
        exit;
    }
    $u = $_SESSION['wms_user'];

    // Baca config untuk token secret
    $cfg = __DIR__ . '/config.php';
    $secret = 'default_secret';
    if (is_file($cfg)) {
        require_once $cfg;
        if (defined('WMS_TOKEN_SECRET')) $secret = WMS_TOKEN_SECRET;
    }

    // Format token sama dengan api/lib.php (wms_make_token): base64url(username|ts).hmac_sha256
    $payload = rtrim(strtr(base64_encode($u['username'] . '|' . time()), '+/', '-_'), '=');
    $token   = $payload . '.' . hash_hmac('sha256', $payload, $secret);

    echo json_encode([
        'success' => true,
        'data'    => ['token' => $token, 'username' => $u['username']],
    ]);
    exit;
}

// â”€â”€ Koneksi DB produksi â”€â”€
// DB testing di server ini (snapshot dari 159). Host/nama/user/sandi dari config.php. TIDAK ada fallback ke 159 (produksi).
require_once __DIR__ . '/config.php';
$db_host = WMS_DB_HOST;
$db_name = WMS_DB_NAME;
$db_user = WMS_DB_USER;
$db_pass = WMS_DB_PASS;

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT            => 5
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status"=>"ERROR","connected"=>false,"host"=>"$db_host:3306","database"=>$db_name,"message"=>$e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? 'status';

if ($action === 'status') {
    $totalItems = $pdo->query("SELECT COUNT(*) FROM item")->fetchColumn();
    $totalUsers = $pdo->query("SELECT COUNT(*) FROM user_produksi WHERE user_aktif = 1")->fetchColumn();
    echo json_encode([
        "status"      => "ONLINE",
        "connected"   => true,
        "host"        => "$db_host:3306",
        "database"    => $db_name,
        "user"        => $db_user,
        "total_items" => (int)$totalItems,
        "total_users" => (int)$totalUsers,
        "timestamp"   => date('c')
    ]);
    exit;
}

if ($action === 'items') {
    $q     = trim($_GET['q'] ?? $_GET['search'] ?? '');
    $limit = min((int)($_GET['limit'] ?? 40), 100);
    $sql   = "SELECT * FROM item WHERE 1=1";
    $params= [];
    if ($q !== '') {
        $sql .= " AND (ITCODE LIKE ? OR ITNAME LIKE ?)";
        $params = ["%$q%", "%$q%"];
    }
    $sql .= " ORDER BY ITCODE ASC LIMIT $limit";
    $stmt  = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows  = $stmt->fetchAll();
    $mapped= array_map(function($r){
        $name=$r['ITNAME']; $cat='Fasteners';
        if (stripos($name,'MUR')!==false) $cat='Mur / Nut';
        elseif (stripos($name,'BAUT')!==false) $cat='Baut / Bolt';
        return ['id'=>(int)$r['id'],'sku'=>$r['ITCODE'],'barcode'=>$r['ITCODE'],
                'name'=>$r['ITNAME'],'category'=>$cat,'stock_system'=>(float)($r['STOCK']??0),
                'unit'=>($r['UNIT']??null)?:null,'pack'=>($r['PACK']??null)?:null,
                'isi_per_pack'=>(($r['ISI']??null)!==null && ($r['ISI']??null)!=='' ? (float)($r['ISI']??null) : null),
                'warehouse_code'=>($r['WCODE']??null)?:null,
                'rack_code'=>null,'shelf_tier'=>null,'status'=>'active',
                'price'=>isset($r['PRICE'])?(float)$r['PRICE']:null,'is_live_db'=>true];
    }, $rows);
    echo json_encode(["success"=>true,"count"=>count($mapped),"data"=>$mapped]);
    exit;
}

if ($action === 'warehouses') {
    $stmt = $pdo->query("SELECT kode,nama,active,type,packing_default FROM wip_lokasi_m WHERE active=1 ORDER BY no_urut ASC");
    $rows = $stmt->fetchAll();
    echo json_encode(["success"=>true,"count"=>count($rows),"data"=>$rows]);
    exit;
}

if ($action === 'item') {
    $code = trim($_GET['code'] ?? '');
    $stmt = $pdo->prepare("SELECT * FROM item WHERE ITCODE=? OR ITNAME=? LIMIT 1");
    $stmt->execute([$code,$code]);
    $r = $stmt->fetch();
    if ($r) {
        $name=$r['ITNAME']; $cat='Fasteners';
        if (stripos($name,'MUR')!==false) $cat='Mur / Nut';
        elseif (stripos($name,'BAUT')!==false) $cat='Baut / Bolt';
        echo json_encode(["success"=>true,"found"=>true,"item"=>[
            'id'=>(int)$r['id'],'sku'=>$r['ITCODE'],'barcode'=>$r['ITCODE'],
            'name'=>$r['ITNAME'],'category'=>$cat,'stock_system'=>(float)($r['STOCK']??0),
            'unit'=>($r['UNIT']??null)?:null,'pack'=>($r['PACK']??null)?:null,
            'isi_per_pack'=>(($r['ISI']??null)!==null && ($r['ISI']??null)!=='' ? (float)($r['ISI']??null) : null),
            'warehouse_code'=>($r['WCODE']??null)?:null,
            'rack_code'=>null,'shelf_tier'=>null,'status'=>'active',
            'price'=>isset($r['PRICE'])?(float)$r['PRICE']:null,'is_live_db'=>true
        ]]);
    } else {
        echo json_encode(["success"=>true,"found"=>false,"message"=>"Item tidak ditemukan"]);
    }
    exit;
}

echo json_encode(["status"=>"ONLINE","message"=>"PT Unison WMS PHP API Bridge"]);