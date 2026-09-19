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
