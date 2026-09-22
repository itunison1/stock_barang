#!/usr/bin/env bash
# Deploy otomatis Stock Opname: build di .108 (Linux), upload ke staging .140.
# Mesin build .119 TIDAK lagi dipakai untuk build (RAM-nya habis oleh IDE cseon;
# setiap gradle build di sana membuat HVADMIN2 hang 1-2+ jam — insiden 21-22/09/2026).
#
# Pakai:
#   STOCKOPNAME_FTP_USER=cseon STOCKOPNAME_FTP_PASS=**** ./deploy-140.sh --web
#   STOCKOPNAME_FTP_USER=cseon STOCKOPNAME_FTP_PASS=**** ./deploy-140.sh --apk
#   ./deploy-140.sh --web --apk
#
# Kredensial: env var saja (lihat hv-uns.env RECORD_18). JANGAN ditulis di repo.
# Kebutuhan lokal (.108): JDK 17, ANDROID_SDK (platform 34+35, build-tools 35.0.0),
#   node/npm, curl, debug.keystore dari .119 di ~/.android/debug.keystore
#   (signature WAJIB sama dengan APK live — cek: apksigner verify --print-certs).
set -euo pipefail

HOST140="${HOST140:-192.168.1.140}"
REPO="${REPO:-/tmp/sb_build}"
BRANCH="feat/android-native"
SDK="${ANDROID_HOME:-$HOME/android-sdk}"

fail() { echo "[DEPLOY-GAGAL] $*" >&2; exit 1; }
ok()   { echo "[OK] $*"; }

[ -n "${STOCKOPNAME_FTP_USER:-}" ] && [ -n "${STOCKOPNAME_FTP_PASS:-}" ] \
  || fail "Set STOCKOPNAME_FTP_USER dan STOCKOPNAME_FTP_PASS dulu (jangan pernah ditulis di repo)."

# ---------- gerbang git ----------
cd "$REPO"
BRANCH_NOW=$(git branch --show-current)
[ "$BRANCH_NOW" = "$BRANCH" ] || fail "Branch aktif '$BRANCH_NOW', harus '$BRANCH'."
git fetch origin
[ -z "$(git status --porcelain)" ] || fail "Working tree kotor - commit/push dulu."
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/$BRANCH)" ] \
  || fail "HEAD != origin/$BRANCH - push/pull dulu."
ok "git bersih: $BRANCH @ $(git rev-parse --short HEAD)"

ftp_put() { # $1=local $2=remote
  curl -sS --connect-timeout 15 -T "$1" \
    "ftp://$HOST140$2" --user "$STOCKOPNAME_FTP_USER:$STOCKOPNAME_FTP_PASS"
}
http_code() { curl -s -o /dev/null -w '%{http_code}' -m 15 -I "$1" || echo 0; }

# ---------- jalur APK ----------
if [[ " $* " == *" --apk "* ]]; then
  KTS="android/app/build.gradle.kts"
  VC=$(grep -oE 'versionCode\s*=\s*[0-9]+' "$KTS" | grep -oE '[0-9]+')
  VN=$(grep -oE 'versionName\s*=\s*"[^"]+"' "$KTS" | cut -d'"' -f2)
  echo "[i] versionCode=$VC versionName=$VN"

  APK_NAME="StockOpname-$VN.apk"
  APK_URL="http://$HOST140/stock/updates/$APK_NAME"
  [ "$(http_code "$APK_URL")" = "200" ] \
    && fail "$APK_NAME sudah ada di server. Naikkan versionCode/versionName di build.gradle.kts dulu."

  # signature wajib = keystore .119 (debug keystore bawaan mesin ini TIDAK boleh dipakai)
  [ -f "$HOME/.android/debug.keystore" ] || fail "~/.android/debug.keystore (milik .119) belum ada."
  CERT_KS=$(keytool -list -v -keystore "$HOME/.android/debug.keystore" -storepass android -alias androiddebugkey 2>/dev/null \
            | grep -oE 'SHA256: [A-F0-9:]+' | head -1 | tr -d ':' | awk '{print tolower($2)}')
  [ "${CERT_KS:0:8}" = "7bd5d7cc" ] || fail "debug.keystore lokal BUKAN milik .119 (hash ${CERT_KS:0:16}...). Jangan rilis!"
  ok "debug.keystore = milik .119 (7bd5d7cc...)"

  echo "[i] gradlew assembleRelease..."
  (cd android && sh gradlew :app:testDebugUnitTest :app:assembleRelease --no-daemon | tail -3)
  APK="android/app/build/outputs/apk/release/app-release.apk"
  [ -f "$APK" ] || fail "APK fisik tidak ada setelah build."
  CERT_APK=$("$SDK/build-tools/35.0.0/apksigner" verify --print-certs "$APK" \
             | grep -oE 'SHA-256 digest: [a-f0-9]+' | head -1 | awk '{print $3}')
  [ "${CERT_APK:0:8}" = "7bd5d7cc" ] || fail "APK ter-sign salah ($CERT_APK) - keystore bukan milik .119."
  ok "signature APK terverifikasi (7bd5d7cc...)"

  # urutan wajib: APK upload -> verifikasi 200 -> BARU version.json
  ftp_put "$APK" "/stock/updates/$APK_NAME"
  [ "$(http_code "$APK_URL")" = "200" ] || fail "APK belum bisa diunduh - JANGAN lanjut ke version.json"
  ok "APK live: $APK_URL (200)"

  printf '{"versionCode": %s, "versionName": "%s", "apkFileName": "%s", "notes": "Lihat commit log repo.", "mandatory": false}' \
    "$VC" "$VN" "$APK_NAME" > /tmp/version.json
  ftp_put /tmp/version.json /stock/updates/version.json
  ok "version.json -> $APK_NAME"
fi

# ---------- jalur web + backend ----------
if [[ " $* " == *" --web "* ]]; then
  echo "[i] vite build..."
  [ -d node_modules ] || npm install
  npm run build
  [ -f dist/index.html ] || fail "dist/index.html tidak ada"
  ok "vite build selesai"

  # backend PHP -> /stock/ dan /stock/api/
  for f in api.php login.php index.php logout.php .htaccess; do
    [ -f "backend/$f" ] && ftp_put "backend/$f" "/stock/$f" && ok "upload /stock/$f"
  done
  for f in backend/api/*.php; do
    ftp_put "$f" "/stock/api/$(basename "$f")"
  done
  ok "upload /stock/api/*.php"
  if [ -d backend/admin ]; then
    for f in backend/admin/*; do
      ftp_put "$f" "/stock/admin/$(basename "$f")"
    done
    ok "upload /stock/admin/*"
  fi

  # dist -> /stock/ (api.php dari backend yang menang, bukan salinan vite)
  find dist -type f | while read -r f; do
    rel="${f#dist/}"
    [ "$rel" = "api.php" ] && continue
    ftp_put "$f" "/stock/$rel"
  done
  ok "dist/ ter-deploy"

  STATUS=$(curl -s -m 15 "http://$HOST140/stock/api.php?action=status")
  echo "$STATUS" | grep -q '"status":"ONLINE"' || fail "API tidak ONLINE: $STATUS"
  ok "API ONLINE: $(echo "$STATUS" | grep -oE '"database":"[^"]+"')"
fi

[[ " $* " == *"--apk"* || " $* " == *"--web"* ]] || { grep '^# Pakai:' -A3 "$0"; exit 0; }
echo "[DEPLOY-SELESAI]"
