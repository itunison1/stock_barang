<?php
session_start();
require_once __DIR__ . '/config.php';

if (isset($_SESSION['wms_user'])) {
    header('Location: index.php');
    exit;
}

$message = '';
$lastUser = isset($_COOKIE['wms_lastuser']) ? htmlspecialchars($_COOKIE['wms_lastuser']) : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $remember = isset($_POST['remember']);

    if (empty($username) || empty($password)) {
        $message = 'Username dan password wajib diisi.';
    } else {
        mysqli_report(MYSQLI_REPORT_OFF);
        $conn = @mysqli_connect(WMS_DB_HOST, WMS_DB_USER, WMS_DB_PASS, WMS_DB_NAME);
        if (!$conn) {
            $message = 'Database tidak terjangkau. Coba lagi nanti.';
        } else {
            mysqli_set_charset($conn, 'utf8mb4');
            $stmt = mysqli_prepare($conn, "SELECT iduser, username, userpassword, user_divisi, user_level FROM user_produksi WHERE LOWER(username) = ? AND user_aktif = '1' LIMIT 1");
            $lower = strtolower($username);
            mysqli_stmt_bind_param($stmt, 's', $lower);
            mysqli_stmt_execute($stmt);
            $result = mysqli_stmt_get_result($stmt);

            if (mysqli_num_rows($result) > 0) {
                $user = mysqli_fetch_assoc($result);
                $ok = password_verify($password, $user['userpassword']);
                if (!$ok && strlen($user['userpassword']) > 0 && $password === $user['userpassword']) {
                    $ok = true;
                }
                if ($ok) {
                    session_regenerate_id(true);
                    $_SESSION['wms_user'] = [
                        'iduser' => $user['iduser'],
                        'username' => $user['username'],
                        'user_divisi' => $user['user_divisi'],
                        'user_level' => $user['user_level'],
                    ];
                    if ($remember) {
                        setcookie('wms_lastuser', $user['username'], time() + 60*60*24*30, '/stock/', true, true, 'Lax');
                    } else {
                        setcookie('wms_lastuser', '', time() - 3600, '/stock/', true, true, 'Lax');
                    }
                    header('Location: index.php');
                    exit;
                }
            }
            $message = 'Username atau password salah.';
            mysqli_stmt_close($stmt);
            mysqli_close($conn);
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login — WMS Stock Opname PT Unison</title>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
:root{--bg:#050811;--bg-2:#0f172a;--txt:#e2e8f0;--muted:#94a3b8;--border:#1e293b;--accent:#0ea5e9;--accent-2:#06b6d4;--accent-3:#22c55e;--grad-accent:linear-gradient(135deg,#0ea5e9 0%,#06b6d4 50%,#22c55e 100%);--acc-glow:rgba(14,165,233,.25);--glass-bg:rgba(15,23,42,.7);--glass-brd:rgba(255,255,255,.08);--shadow-lg:0 20px 60px rgba(0,0,0,.4);--font-display:'Rajdhani',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;-webkit-font-smoothing:antialiased}
#login-page{position:relative;display:flex;align-items:center;justify-content:center;min-height:100vh;gap:70px;padding:20px;background:radial-gradient(ellipse 900px 520px at 20% 8%,rgba(14,165,233,.18) 0%,transparent 60%),radial-gradient(ellipse 700px 500px at 88% 92%,rgba(6,182,212,.12) 0%,transparent 55%),radial-gradient(ellipse 600px 400px at 50% 50%,rgba(34,197,94,.06) 0%,transparent 60%),var(--bg)}
#login-page::before,#login-page::after{content:'';position:absolute;border-radius:50%;filter:blur(70px);pointer-events:none;z-index:0}
#login-page::before{width:340px;height:340px;top:-90px;left:-90px;background:rgba(14,165,233,.25);animation:orbFloat 8s ease-in-out infinite}
#login-page::after{width:300px;height:300px;bottom:-100px;right:-60px;background:rgba(34,197,94,.15);animation:orbFloat 6s ease-in-out infinite reverse}
@keyframes orbFloat{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-20px)}}
.login-visual{position:relative;z-index:1;flex:1 1 480px;max-width:480px;height:520px;display:flex;align-items:center;justify-content:center}
.bolt-scene{position:relative;width:100%;height:100%}
.bolt{position:absolute;color:var(--accent-2);filter:drop-shadow(0 12px 30px rgba(14,165,233,.35));animation-timing-function:linear,ease-in-out;animation-iteration-count:infinite,infinite}
.bolt-lg{width:230px;height:230px;top:50%;left:50%;margin:-115px 0 0 -115px;opacity:.95;animation-name:boltSpin;animation-duration:16s}
.bolt-md{width:120px;height:120px;top:10%;right:6%;opacity:.55;color:var(--accent);animation-name:boltSpinRev,boltFloat;animation-duration:11s,5s}
.bolt-sm{width:70px;height:70px;bottom:10%;left:2%;opacity:.4;color:#0ea5e9;animation-name:boltSpin,boltFloat;animation-duration:7.5s,4s;animation-delay:0s,.8s}
.bolt-xs{width:44px;height:44px;bottom:22%;right:16%;opacity:.3;color:#67e8f9;animation-name:boltSpinRev,boltFloat;animation-duration:5.5s,3.4s;animation-delay:0s,1.4s}
@keyframes boltSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes boltSpinRev{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
@keyframes boltFloat{0%,100%{margin-top:0}50%{margin-top:-14px}}
.bolt-ring{position:absolute;top:50%;left:50%;border-radius:50%;border:1px dashed rgba(14,165,233,.2);pointer-events:none}
.bolt-ring.r1{width:340px;height:340px;margin:-170px 0 0 -170px;animation:boltSpin 40s linear infinite}
.bolt-ring.r2{width:420px;height:420px;margin:-210px 0 0 -210px;animation:boltSpinRev 55s linear infinite}
.login-visual-text{position:absolute;left:0;right:0;bottom:0;text-align:center;z-index:2}
.lv-title{font-family:var(--font-display);font-size:23px;font-weight:700;letter-spacing:.2px;margin-bottom:10px}
.lv-title span{color:var(--accent-2)}
.lv-tagline{font-family:var(--font-display);font-size:15px;font-weight:600;margin-bottom:6px;letter-spacing:.2px}
.lv-sub{font-size:13px;color:var(--muted);max-width:340px;margin:0 auto;line-height:1.6}
.login-box{position:relative;z-index:1;flex:1 1 420px;max-width:420px;padding:36px 32px;background:var(--glass-bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--glass-brd);border-radius:20px;box-shadow:var(--shadow-lg)}
.lb-logo{text-align:center;margin-bottom:24px}
.lb-logo h2{font-family:var(--font-display);font-size:20px;font-weight:700;letter-spacing:.3px;margin-top:12px}
.lb-logo p{font-size:12px;color:var(--muted);margin-top:6px}
.form-group{margin-bottom:18px}
.form-group label{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.input-wrapper{position:relative}
.input-wrapper svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--muted);transition:color .2s;pointer-events:none}
.input-wrapper input{width:100%;padding:13px 42px 13px 44px;background:rgba(5,8,17,.6);border:1px solid var(--border);border-radius:10px;color:var(--txt);font-size:14px;font-family:'Inter',sans-serif;transition:all .2s;outline:none}
.input-wrapper input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(14,165,233,.15)}
.input-wrapper input:focus+svg,.input-wrapper input:focus~svg{color:var(--accent)}
.input-wrapper input::placeholder{color:#475569}
.password-toggle{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:4px;display:flex;align-items:center;transition:color .2s}
.password-toggle:hover{color:var(--txt)}
.password-toggle svg{position:static;transform:none;width:18px;height:18px}
.form-options{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.checkbox-wrapper{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
.checkbox-wrapper input[type=checkbox]{width:14px;height:14px;accent-color:var(--accent);border-radius:4px;cursor:pointer}
.checkbox-wrapper span{font-size:12px;color:var(--muted)}
.submit-btn{width:100%;padding:14px;background:var(--grad-accent);border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:600;font-family:var(--font-display);letter-spacing:.5px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.submit-btn:hover{box-shadow:0 8px 24px -8px rgba(14,165,233,.5);transform:translateY(-1px)}
.submit-btn:active{transform:translateY(0)}
.submit-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,transparent,rgba(255,255,255,.15),transparent);transform:translateX(-100%);transition:transform .5s}
.submit-btn:hover::after{transform:translateX(100%)}
.error-message{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:10px 14px;margin-bottom:18px;display:flex;align-items:center;gap:10px;font-size:13px;color:#fca5a5}
.error-message svg{width:18px;height:18px;flex-shrink:0;color:#ef4444}
.lb-footer{text-align:center;margin-top:20px;font-size:11px;color:#475569}
.lb-footer a{color:var(--accent);text-decoration:none}
@media(max-width:980px){#login-page{flex-direction:column;gap:30px}.login-visual{display:none!important}.login-box{max-width:100%}}
</style>
</head>
<body>
<div id="login-page">
  <div class="login-visual">
    <div class="bolt-scene">
      <svg class="bolt bolt-lg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      <svg class="bolt bolt-md" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      <svg class="bolt bolt-sm" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      <svg class="bolt bolt-xs" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      <div class="bolt-ring r1"></div>
      <div class="bolt-ring r2"></div>
    </div>
    <div class="login-visual-text">
      <div class="lv-title">WMS <span>Stock Opname</span></div>
      <div class="lv-tagline">PT Unison Industrial Indonesia</div>
      <div class="lv-sub">Sistem Manajemen Stock Opname Mode A (Fasteners / Mur &amp; Baut) — 11 Gudang Terintegrasi</div>
    </div>
  </div>
  <div class="login-box">
    <div class="lb-logo">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="url(#g1)"/><path d="M24 8L11 15v12l13 7 13-7V15L24 8z" stroke="#fff" stroke-width="2" fill="none"/><path d="M24 8v22M11 15l13 7 13-7" stroke="#fff" stroke-width="2" fill="none"/><defs><linearGradient id="g1" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#0ea5e9"/><stop offset=".5" stop-color="#06b6d4"/><stop offset="1" stop-color="#22c55e"/></linearGradient></defs></svg>
      <h2>Selamat Datang</h2>
      <p>Silakan masuk untuk melanjutkan</p>
    </div>
    <?php if($message):?>
    <div class="error-message">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <?php echo htmlspecialchars($message);?>
    </div>
    <?php endif;?>
    <form method="POST" action="" autocomplete="off">
      <div class="form-group">
        <label for="username">Username</label>
        <div class="input-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <input type="text" id="username" name="username" placeholder="Masukkan username" value="<?php echo $lastUser;?>" required autofocus>
        </div>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <div class="input-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input type="password" id="password" name="password" placeholder="Masukkan password" required>
          <button type="button" class="password-toggle" onclick="togglePassword()" aria-label="Toggle password">
            <svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div class="form-options">
        <label class="checkbox-wrapper">
          <input type="checkbox" name="remember" <?php echo $lastUser?'checked':'';?>>
          <span>Ingat saya</span>
        </label>
      </div>
      <button type="submit" class="submit-btn">Masuk ke Dashboard</button>
    </form>
    <div class="lb-footer"><p>Stock Opname Barang &copy; 2026 <a href="#">PT Unison Industrial Indonesia</a></p></div>
  </div>
</div>
<script>
function togglePassword(){
  const input=document.getElementById('password');
  const icon=document.getElementById('eye-icon');
  if(input.type==='password'){
    input.type='text';
    icon.innerHTML='<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    input.type='password';
    icon.innerHTML='<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}
</script>
</body>
</html>
