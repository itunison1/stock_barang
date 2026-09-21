# Deploy otomatis ke .140

Satu-satunya jalur deploy staging. **Dilarang mengedit file langsung di .140** —
repo ini adalah satu-satunya sumber kode (pelajaran 2026-09-21: kerja paralel
.119/.140 tanpa commit membuat keduanya saling berbeda).

## Siapkan (sekali)

Kredensial FTP .140 disimpan sebagai environment variable Windows di .119,
JANGAN ditulis di repo:

```powershell
setx STOCKOPNAME_FTP_USER cseon
setx STOCKOPNAME_FTP_PASS ****   # isi manual, lihat hv-uns.env RECORD_18
```

## Pakai

```powershell
# web + backend PHP saja
powershell -ExecutionPolicy Bypass -File deploy\deploy-to-140.ps1 -Web

# APK baru + version.json (naikkan versionCode/versionName di
# android/app/build.gradle.kts DULU, sesuai SOP §5)
powershell -ExecutionPolicy Bypass -File deploy\deploy-to-140.ps1 -Apk

# keduanya
powershell -ExecutionPolicy Bypass -File deploy\deploy-to-140.ps1 -Web -Apk
```

## Gerbang bawaan script

- Git harus bersih, HEAD == origin, branch `feat/android-native`/`main`.
- APK: menolak menimpa APK yang sudah ada di server (wajib naik versi dulu).
- Urutan wajib dijaga: APK upload → verifikasi 200 → baru `version.json`.
- Tidak pernah menulis ke `config.php`, `uploads/`, atau memodifikasi
  `updates/` di luar APK + `version.json`.
- Setelah deploy: verifikasi `api.php?action=status` harus `ONLINE`.
