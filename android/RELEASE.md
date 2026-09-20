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


## Catatan Rilis v1.3 (2026-09-20)
- **Splash Screen Branded**: Identitas visual PT Unison Industrial Indonesia memakai aset logo perusahaan resmi (`unison_logo.png`) sebelum login.
- **Login Modern & Aman**: Tampilan login modern hierarchy rapi, toggle show/hide password (ikon mata) dengan touch target & contentDescription, checkbox "Ingat saya" (hanya menyimpan username di preferensi terenkripsi, tidak menyimpan password plaintext).
- **Dashboard Operasional (Fase B)**: Menu visual card setelah login (bukan dump list 19 gudang): Mulai Opname, Lanjutkan Sesi, Scan Barang Cepat, Data Belum Sinkron (Outbox), Riwayat Hitung, Status Persetujuan, Cetak Label, Pengaturan. Card yang belum tersedia berlabel "Segera Hadir" (tanpa navigasi palsu).
- **Pilihan Gudang Informatif**: Grid 2-kolom dengan kode + nama gudang, real-time search & filter untuk 19 gudang, navigasi kembali (back) jelas ke Dashboard.
- **Staging Preservation**: Mempertahankan staging `192.168.1.140:3306/stockopname_test` dan base URL `http://192.168.1.140/stock/api/`.

## Catatan Rilis v1.3.1 (2026-09-20)
- Tombol Back dari sesi langsung kembali ke satu Dashboard; sesi opname tetap aktif, tanpa modal pilihan berulang.
- CTA `Lanjutkan Sesi` duplikat dihapus; satu tombol sesi aktif menjadi jalur utama.
- Seluruh dialog Dashboard memakai teks gelap yang terbaca pada background putih.
- Printer default tunggal sementara: POS-80C LAN `192.168.1.206:9100`; seed printer yang belum tersedia dihapus.
