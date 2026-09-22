# Deploy otomatis ke .140

Satu-satunya jalur deploy staging. **Dilarang mengedit file langsung di .140** —
repo ini adalah satu-satunya sumber kode (pelajaran 2026-09-21: kerja paralel
.119/.140 tanpa commit membuat keduanya saling berbeda).

## Jalur utama: Linux .108 (`deploy/deploy-140.sh`)

Mesin build adalah .108. **.119 tidak lagi dipakai untuk build** — setiap gradle
build di sana membuat HVADMIN2 hang 1-2+ jam (gradle + IDE cseon habiskan RAM;
insiden 21-22/09/2026).

Prasyarat sekali di .108 (sudah terpasang):
- JDK 17, Android SDK di `~/android-sdk` (platform 34+35, build-tools 35.0.0)
- `~/.android/debug.keystore` = **salinan keystore .119** (signature APK live
  `7bd5d7cc...` — tanpa ini auto-update HP ditolak, script menolak jalan)
- kredensial FTP via env (lihat `hv-uns.env` RECORD_18, JANGAN ditulis di repo)

```bash
STOCKOPNAME_FTP_USER=cseon STOCKOPNAME_FTP_PASS=**** ./deploy/deploy-140.sh --web --apk
```

## Cadangan: Windows .119 (`deploy/deploy-to-140.ps1`)

Hanya bila .108 tidak tersedia. Kredensial via `setx STOCKOPNAME_FTP_USER/PASS`.

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-to-140.ps1 -Web -Apk
```

## Gerbang bawaan (kedua script)

- Git harus bersih, HEAD == origin, branch `feat/android-native`/`main`.
- APK: menolak menimpa APK yang sudah ada di server (wajib naik versi dulu,
  sesuai SOP §5 — naikkan `versionCode`/`versionName` di
  `android/app/build.gradle.kts` DULU).
- APK: verifikasi signature = keystore .119 (`7bd5d7cc...`) sebelum upload.
- Urutan wajib: APK upload → verifikasi 200 → baru `version.json`.
- Tidak pernah menulis ke `config.php`, `uploads/`, atau memodifikasi
  `updates/` di luar APK + `version.json`.
- Setelah deploy: verifikasi `api.php?action=status` harus `ONLINE`.
