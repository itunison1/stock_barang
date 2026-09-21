#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy otomatis Stock Opname dari repo (HEAD bersih) ke staging 192.168.1.140.

.DESCRIPTION
  Aturan yang dibakukan (lihat backend/README.md dan runbook SOP-StockOpname):
  1. Repo adalah satu-satunya sumber kode. Kalau working tree kotor -> STOP.
  2. Urutan wajib: APK upload dulu -> verifikasi 200 -> BARU version.json.
  3. TIDAK PERNAH menimpa: config.php, uploads/, updates/ (kecuali APK + version.json
     yang memang bagian dari release).
  4. Semua langkah diverifikasi (curl/FTP), gagal = berhenti sebelum merusak.

.PARAMETER Web
  Deploy web (vite build -> /stock/) + backend PHP (backend/* -> /stock/).

.PARAMETER Apk
  Build assembleRelease dan upload APK baru + version.json.

.EXAMPLE
  # kredensial diambil dari environment, JANGAN ditulis di repo:
  #   setx STOCKOPNAME_FTP_USER cseon
  #   setx STOCKOPNAME_FTP_PASS ****
  .\deploy-to-140.ps1 -Web -Apk
#>
param(
  [switch]$Web,
  [switch]$Apk,
  [string]$Repo = "C:\Users\cseon\Documents\Project_Unison\Stock_Opname_Barang",
  [string]$Host140 = "192.168.1.140"
)

$ErrorActionPreference = "Stop"

function Fail($msg) { Write-Host "[DEPLOY-GAGAL] $msg" -ForegroundColor Red; exit 1 }
function Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }

# ---------- kredensial ----------
$ftpUser = $env:STOCKOPNAME_FTP_USER
$ftpPass = $env:STOCKOPNAME_FTP_PASS
if (-not $ftpUser -or -not $ftpPass) {
  Fail "Set env STOCKOPNAME_FTP_USER dan STOCKOPNAME_FTP_PASS dulu (jangan pernah ditulis di repo)."
}

# ---------- gerbang git ----------
Set-Location $Repo
$branch = git branch --show-current
if ($branch -ne "feat/android-native" -and $branch -ne "main") {
  Fail "Branch aktif '$branch'. Deploy hanya dari feat/android-native atau main."
}
$dirty = git status --porcelain
if ($dirty) { Fail "Working tree kotor - commit/push dulu:`n$dirty" }
git fetch origin 2>$null
$local  = git rev-parse HEAD
$remote = git rev-parse "origin/$branch"
if ($local -ne $remote) { Fail "HEAD $local != origin/$branch $remote - push/pull dulu." }
Ok "git bersih: $branch @ $($local.Substring(0,8))"

# ---------- helpers FTP ----------
function Ftp-Upload($localFile, $remotePath) {
  $req = [Net.FtpWebRequest]::Create("ftp://${Host140}${remotePath}")
  $req.Method = [Net.WebRequestMethods+Ftp]::UploadFile
  $req.Credentials = New-Object Net.NetworkCredential($ftpUser, $ftpPass)
  $req.UseBinary = $true
  $bytes = [IO.File]::ReadAllBytes($localFile)
  $stream = $req.GetRequestStream()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()
  $resp = $req.GetResponse()
  $resp.Close()
}

function Ftp-Delete($remotePath) {
  try {
    $req = [Net.FtpWebRequest]::Create("ftp://${Host140}${remotePath}")
    $req.Method = [Net.WebRequestMethods+Ftp]::DeleteFile
    $req.Credentials = New-Object Net.NetworkCredential($ftpUser, $ftpPass)
    $req.GetResponse().Close()
  } catch { } # 550 = tidak ada, abaikan
}

function Http-Code($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 15
    return [int]$r.StatusCode
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return $code
  }
}

# ---------- jalur APK ----------
if ($Apk) {
  $gradleKts = "$Repo\android\app\build.gradle.kts"
  $vc = (Select-String -Path $gradleKts -Pattern "versionCode\s*=\s*(\d+)").Matches[0].Groups[1].Value
  $vn = (Select-String -Path $gradleKts -Pattern 'versionName\s*=\s*"([^"]+)"').Matches[0].Groups[1].Value
  Write-Host "[i] versionCode=$vc versionName=$vn"

  $apkDir = "$Repo\android\app\build\outputs\apk\release"
  Remove-Item "$apkDir\app-release.apk" -Force -ErrorAction SilentlyContinue

  Write-Host "[i] gradlew assembleRelease (bisa 1-5 menit)..."
  Push-Location "$Repo\android"
  & .\gradlew.bat :app:assembleRelease --no-daemon 2>&1 | Select-Object -Last 3
  $rc = $LASTEXITCODE
  Pop-Location
  if ($rc -ne 0) { Fail "assembleRelease exit=$rc" }

  $apk = Get-Item "$apkDir\app-release.apk" -ErrorAction SilentlyContinue
  if (-not $apk) { Fail "APK fisik tidak ada setelah build (SOP §1)" }
  Ok "APK: $($apk.Length) bytes @ $($apk.LastWriteTime)"

  # cegah rilis versi sama yang menimpa beda isi
  $apkName = "StockOpname-$vn.apk"
  $remoteUrl = "http://${Host140}/stock/updates/$apkName"
  $existing = Http-Code $remoteUrl
  if ($existing -eq 200) {
    Fail "$apkName sudah ada di server dengan mungkin isi beda. NAIKKKAN versionCode/versionName dulu di build.gradle.kts."
  }

  # urutan wajib: APK dulu -> verifikasi -> version.json terakhir
  Ftp-Upload $apk.FullName "/stock/updates/$apkName"
  $code = Http-Code $remoteUrl
  if ($code -ne 200) { Fail "APK belum bisa diunduh (HTTP $code) - JANGAN lanjut ke version.json" }
  Ok "APK live: $remoteUrl (200)"

  $versionJson = @"
{"versionCode": $vc, "versionName": "$vn", "apkFileName": "$apkName", "notes": "Lihat commit log repo.", "mandatory": false}
"@
  $tmp = "$env:TEMP\version.json"
  [IO.File]::WriteAllText($tmp, $versionJson)
  Ftp-Upload $tmp "/stock/updates/version.json"
  Ok "version.json menunjuk $apkName"
}

# ---------- jalur web + backend ----------
if ($Web) {
  Write-Host "[i] vite build..."
  Push-Location $Repo
  if (-not (Test-Path node_modules)) { npm install; if ($LASTEXITCODE -ne 0) { Fail "npm install" } }
  npm run build
  if ($LASTEXITCODE -ne 0) { Fail "npm run build" }
  Pop-Location
  if (-not (Test-Path "$Repo\dist\index.html")) { Fail "dist/index.html tidak ada" }
  Ok "vite build selesai"

  # backend PHP -> /stock/
  foreach ($f in @("api.php","login.php","index.php","logout.php",".htaccess")) {
    if (Test-Path "$Repo\backend\$f") {
      Ftp-Upload "$Repo\backend\$f" "/stock/$f"
      Ok "upload /stock/$f"
    }
  }
  # endpoint PHP -> /stock/api/
  Get-ChildItem "$Repo\backend\api" -Filter *.php | ForEach-Object {
    Ftp-Upload $_.FullName "/stock/api/$($_.Name)"
    Ok "upload /stock/api/$($_.Name)"
  }
  if (Test-Path "$Repo\backend\admin") {
    Get-ChildItem "$Repo\backend\admin" -File | ForEach-Object {
      Ftp-Upload $_.FullName "/stock/admin/$($_.Name)"
      Ok "upload /stock/admin/$($_.Name)"
    }
  }

  # web build -> /stock/ (JANGAN sentuh config.php / updates / uploads)
  Get-ChildItem "$Repo\dist" -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring("$Repo\dist\".Length).Replace("\", "/")
    if ($rel -like "api.php" -and (Test-Path "$Repo\backend\api.php")) { return } # pakai versi backend
    Ftp-Upload $_.FullName "/stock/$rel"
  }
  Ok "dist/ ter-deploy"

  # verifikasi
  $status = Invoke-RestMethod "http://${Host140}/stock/api.php?action=status" -TimeoutSec 15
  if ($status.status -ne "ONLINE") { Fail "API tidak ONLINE setelah deploy: $($status | ConvertTo-Json -Compress)" }
  Ok "API ONLINE: db=$($status.database) items=$($status.total_items)"
  $idx = Http-Code "http://${Host140}/stock/"
  if ($idx -ge 400) { Fail "GET /stock/ = $idx" }
  Ok "Deploy web selesai dan terverifikasi"
}

if (-not $Web -and -not $Apk) {
  Write-Host "Pakai: .\deploy-to-140.ps1 [-Web] [-Apk]"
}
Write-Host "[DEPLOY-SELESAI]" -ForegroundColor Cyan
