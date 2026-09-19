# Rilis APK Stock Opname

Meniru alur MVNative (MEview). Server: 192.168.1.140, folder `stock/updates/`.

## Sekali saja: keystore rilis
Keystore HARUS sama untuk semua rilis. Kalau ganti atau hilang, Android menolak update dan semua HP harus install ulang manual.

    keytool -genkeypair -v -keystore android/keystore/stockopname-release.jks \
      -alias stockopname -keyalg RSA -keysize 2048 -validity 10000

Buat `android/keystore.properties` (tidak ter-commit):

    storeFile=keystore/stockopname-release.jks
    storePassword=...
    keyAlias=stockopname
    keyPassword=...

Backup `.jks` dan kata sandinya di tempat aman di luar repo dan luar PC ini.
Tanpa `keystore.properties`, build release jatuh ke debug keystore (hanya untuk uji lokal, JANGAN diedarkan).

## Setiap rilis
1. Naikkan `versionCode` dan `versionName` di `android/app/build.gradle.kts`.
2. `cd android && ./gradlew :app:testDebugUnitTest :app:assembleRelease`
3. Salin `app/build/outputs/apk/release/app-release.apk` menjadi `StockOpname-<versionName>.apk`.
4. Upload APK ke `ftp://192.168.1.140/stock/updates/` (user `cseon`, sandi ditanyakan, jangan disimpan di file).
5. Verifikasi: `curl -sI http://192.168.1.140/stock/updates/StockOpname-<versionName>.apk` harus `200`.
6. **Baru** upload `version.json` yang naik (`versionCode`, `versionName`, `apkFileName`, `notes`, `mandatory`).
   Bila terbalik, semua HP langsung ditawari update yang APK-nya belum ada.

`updates/*.apk` tidak ikut commit (`*.apk` ada di `.gitignore`).
