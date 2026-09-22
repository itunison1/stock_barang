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
.hero-scene{position:relative;width:100%;height:100%}
.hero{position:absolute;filter:drop-shadow(0 12px 30px rgba(14,165,233,.35))}
.hero-lg{width:230px;height:230px;top:50%;left:50%;margin:-115px 0 0 -115px;opacity:.95;animation:heroFloat 5s ease-in-out infinite}
.hero-md{width:120px;height:120px;top:10%;right:6%;opacity:.55;animation:heroSpinRev 11s linear infinite}
.hero-sm{width:70px;height:70px;bottom:10%;left:2%;opacity:.4;animation:heroSpin 7.5s linear infinite}
.hero-xs{width:44px;height:44px;bottom:22%;right:16%;opacity:.3;animation:heroSpinRev 5.5s linear infinite}
@keyframes heroSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes heroSpinRev{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
@keyframes heroFloat{0%,100%{margin-top:0}50%{margin-top:-14px}}
.hero-ring{position:absolute;top:50%;left:50%;border-radius:50%;border:1px dashed rgba(14,165,233,.25);pointer-events:none}
.hero-ring.r1{width:340px;height:340px;margin:-170px 0 0 -170px;animation:heroSpin 40s linear infinite}
.hero-ring.r2{width:420px;height:420px;margin:-210px 0 0 -210px;animation:heroSpinRev 55s linear infinite}
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
    <div class="hero-scene">
      <!-- Hero gudang + baut-mur: identik dengan ic_splash_hero.xml Android (fb4d15a) -->
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
        <symbol id="hero-gudang" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="72" fill="#0ea5e9" fill-opacity=".12"/>
          <circle cx="80" cy="80" r="58" fill="#0f172a"/>
          <circle cx="80" cy="80" r="54" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
          <path d="M40,72 L80,50 L120,72 Z" fill="#0ea5e9"/>
          <path d="M46,72 L46,105 L114,105 L114,72 Z" fill="#0f172a" stroke="#0ea5e9" stroke-width="1.5"/>
          <path d="M68,105 L68,85 Q68,82 71,82 L89,82 Q92,82 92,85 L92,105 Z" fill="#050811"/>
          <path d="M80,82 L80,105" fill="none" stroke="#0ea5e9" stroke-width="1"/>
          <path d="M52,78 L63,78 L63,88 L52,88 Z" fill="#0ea5e9" fill-opacity=".15" stroke="#06b6d4" stroke-width="1"/>
          <path d="M97,78 L108,78 L108,88 L97,88 Z" fill="#0ea5e9" fill-opacity=".15" stroke="#06b6d4" stroke-width="1"/>
          <path d="M80,52 L80,72" fill="none" stroke="#67e8f9" stroke-width="1"/>
          <path d="M80,115 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0" fill="#22c55e"/>
          <path d="M72,112 m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0" fill="#67e8f9"/>
          <path d="M88,112 m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0" fill="#67e8f9"/>
        </symbol>
        <symbol id="hero-baut" viewBox="20 19 24 26">
          <path d="M27,28 L32,25 L37,28 L37,34 L32,37 L27,34 Z" fill="#0ea5e9"/>
          <path d="M32,32 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0" fill="#050811"/>
          <path d="M30,37 L30,44 L34,44 L34,37 Z" fill="#0ea5e9"/>
          <path d="M30,39 L34,39 M30,41 L34,41 M30,43 L34,43" fill="none" stroke="#67e8f9" stroke-width="1"/>
        </symbol>
        <symbol id="hero-mur" viewBox="117 16 24 24">
          <path d="M123,25 L129,22 L135,25 L135,33 L129,36 L123,33 Z" fill="#0e7490"/>
          <path d="M129,29 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0" fill="#050811"/>
          <path d="M123,25 L129,22 L135,25 L135,33 L129,36 L123,33 Z" fill="none" stroke="#06b6d4" stroke-width="1"/>
        </symbol>
      </defs></svg>
      <svg class="hero hero-lg"><use href="#hero-gudang"/></svg>
      <svg class="hero hero-md"><use href="#hero-mur"/></svg>
      <svg class="hero hero-sm"><use href="#hero-baut"/></svg>
      <svg class="hero hero-xs"><use href="#hero-mur"/></svg>
      <div class="hero-ring r1"></div>
      <div class="hero-ring r2"></div>
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
