# Android Native — Aplikasi Operator WMS Stock Opname (Fase 1)

PT Unison Industrial Indonesia. Sumber aturan: [PANDUAN_DIREKSI_WMS.md](../../../PANDUAN_DIREKSI_WMS.md) Bab 1-7.
Tanggal: 2026-09-19. Status: draft menunggu review.

## 1. Tujuan dan lingkup

Aplikasi Android native (Kotlin) untuk **operator gudang**. HP berperan sebagai collector + remote printer, bukan penentu data resmi (Bab 1). Approval Direksi/SPV tetap di web dashboard.

**Fase 1 (dokumen ini):** login, kunci sesi gudang, scan barcode (1D + 2D komposit), hitung fisik + variance, alert relokasi, proposal PENDING + foto, cetak label TCP 9100, offline-first Room, auto-sync WorkManager, audit trail lokal.

**Fase 2 (di luar dokumen ini):** kalkulator timbangan, Locator cari lokasi barang, layar approval supervisor.

## 2. Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Lingkup | Operator saja |
| Stack | Kotlin, Jetpack Compose, Room, WorkManager, OkHttp/Retrofit, CameraX + ML Kit, DI manual |
| Target perangkat | Zebra TC26 (Android 10/11): minSdk 26, compileSdk/targetSdk 34 (AGP 8.2.2, toolchain yang sama dengan MVNative) |
| Scanner | DataWedge intent (utama), CameraX + ML Kit (cadangan) |
| Backend | Tambah action tulis di `api.php` + file migrasi SQL `wms_*` |
| Login | Username + password divalidasi `api.php` terhadap `user_produksi` |
| Printer | Semua LAN, raw TCP 9100 ESC/POS. Tanpa Bluetooth |
| Hitung ganda | Scan barang sama di sesi sama: dialog "timpa atau tambahkan" |
| Foto | Kamera saja (tanpa galeri) + hash + cek jam perangkat vs server |
| Sync | UUID klien per record, server idempoten |
| Distribusi | Auto-update ala MVNative: `stock/updates/version.json` + APK di 192.168.1.140, dicek tiap app dibuka. Bukan Play Store |

## 3. Arsitektur

Satu modul `app`, package `com.unison.stockopname` (konsisten dengan `com.unison.mviewnative`).

- `data/`: Room (DAO, entity), `api/` (Retrofit), `printer/` (`PrinterClient`, `EscPosBuilder`), `sync/` (`SyncWorker`, outbox), `prefs/` (token di Keystore).
- `domain/`: aturan murni tanpa Android: `BarcodeParser`, `VarianceCalculator`, `MisplacementChecker`, `DuplicateCountPolicy`, `WatermarkSpec`.
- `ui/`: Compose (Login, PilihGudang, Scan, Hitung, Proposal, Cetak, Pengaturan, Status Sync).
- `AppContainer` di `Application` menyediakan dependensi.

Aturan `domain/` tidak boleh mengimpor `android.*` supaya bisa di-unit-test di JVM.

## 4. Rule ke komponen

| Rule panduan | Komponen |
|---|---|
| Kunci sesi gudang (Bab 2.1) | `StockSession` di Room, satu sesi aktif per operator, 11 gudang dari server |
| Scan barcode terpasang (Bab 2.2) | DataWedge receiver + kamera, input ke `ScanViewModel` |
| Info barang otomatis (Bab 2.3) | Layar hasil scan dari `ItemCache` |
| Variance = fisik − sistem | `VarianceCalculator` |
| Alert relokasi (Bab 2.4) | `MisplacementChecker`: gudang terdaftar ≠ gudang sesi berarti dialog, jika setuju catat `LocationMove` |
| Proposal PENDING + foto wajib (Bab 1) | Form proposal, tombol simpan nonaktif tanpa foto, status hanya `pending` |
| Watermark foto | `Watermarker`: operator, gudang, timestamp, barcode, badge "QC BUKTI FISIK" (ikuti [ProposalModal.jsx](../../../src/components/mobile/ProposalModal.jsx)) |
| Label `DRAFT - PENDING APPROVAL` (Bab 3.3) | `EscPosBuilder.pendingLabel()` |
| Pilih target printer, default per gudang (Bab 3.1) | `PrinterRepository` + selector, IP editable di pengaturan |
| Direct socket tanpa hop server (Bab 3.2) | `PrinterClient`: `Socket` ke `ip:9100`, connect timeout 3 dtk, di `Dispatchers.IO` |
| Offline-first, tidak crash (Bab 4.1) | Jalur scan/hitung/proposal hanya menyentuh Room, tidak ada panggilan jaringan |
| Auto-sync WiFi (Bab 4.2) | `SyncWorker` (constraint `CONNECTED`, backoff eksponensial), unik per-nama |
| Audit trail (Bab 5.2) | `AuditLog` lokal untuk scan, hitung, cetak, proposal, ikut di-sync |

## 5. Model data (Room)

`ItemCache`, `Warehouse`, `PrinterConfig`, `StockSession`, `CountRecord`, `ProposalRecord`, `LocationMove`, `AuditLog`, `OutboxEntry`.

- Setiap record tulis punya `clientUuid` (UUID v4) dan `createdAtDevice`.
- `OutboxEntry`: `id`, `type`, `clientUuid`, `payloadJson`, `status` (`PENDING`/`SENT`/`FAILED`), `attempts`, `lastError`. Dikirim berurutan berdasarkan `id`.
- `ProposalRecord.status` selalu `pending` dari HP. Perubahan ke `active`/`rejected` hanya datang dari server lewat `proposal_status`.
- Foto disimpan di folder private app (`filesDir/photos`), path dan SHA-256 di `ProposalRecord`.

### Hitung ganda
Scan barang sama di sesi sama yang sudah punya `CountRecord`: dialog "Timpa hitungan lama" atau "Tambahkan ke hitungan lama". Keduanya menulis record baru dengan `supersedes` menunjuk record lama, agar audit trail utuh.

## 6. Sinkronisasi master (176 rb item)

- `sync_master` mengembalikan halaman 2000 baris, gzip, dengan `updated_since` bila server mendukung.
- **Prasyarat belum diverifikasi:** tabel `item` punya kolom waktu ubah? Bila tidak, fallback: full refresh terjadwal harian dan hash per halaman. Implementasi memakai antarmuka `MasterSource` supaya kedua strategi bisa ditukar.
- Download berjalan di worker terpisah (`MasterSyncWorker`), dapat dilanjutkan dari halaman terakhir.

## 7. Backend `api.php`

Mengikuti pola MEview (`api/login.php`, `api/_auth.php`), salinan sendiri di folder `stock/`, bukan `require` lintas project.

Action baru, semua tulis butuh token (`X-Auth-Token` atau `Authorization: Bearer`):

| Action | Fungsi |
|---|---|
| `login` | Cek `user_produksi.userpassword` dengan `verifyPassword()` (`password_hash` + fallback ciphertext AES lama), hanya `user_aktif=1`. Token stateless HMAC-SHA256 `base64url(username\|timestamp).signature`, **tanpa tabel token**. `login` WMS **tidak menulis ke `user_produksi`** (tanpa `active_token`, tanpa upgrade hash), supaya operator yang juga login di MEview tidak tertendang |
| `warehouses` | Daftar gudang aktif dari `wip_lokasi_m` |
| `master` | Halaman item (`after_id`, `limit`, `updated_since` opsional), gzip |
| `count` | Idempoten berdasar `client_uuid` |
| `proposal` | Multipart foto + metadata, idempoten, simpan SHA-256, catat `server_received_at`, tandai selisih jam > 5 menit |
| `audit` | Satu entri audit per panggilan, idempoten |
| `proposal_status` | Status proposal milik operator |

Kontrak payload lengkap ada di plan backend. Kendala DB: `usr_android` **tidak punya izin CREATE TABLE** (tercatat di `_auth.php` MEview). Tabel `wms_*` (`wms_counts`, `wms_proposals`, `wms_audit_logs`; sesi hanya dikirim sebagai kolom `session_uuid`) dibuat lewat `migrations/wms_tables.sql` yang dijalankan **DBA/admin dengan akun berhak**. Sampai migrasi dijalankan, endpoint tulis membalas 503 dengan pesan jelas, dan app tetap jalan offline (outbox menunggu). Tidak ada perubahan ke tabel produksi yang sudah ada. Perlu dipastikan juga `usr_android` punya INSERT/UPDATE pada tabel `wms_*` itu.

## 8. Keamanan

- App tidak membawa kredensial MySQL, hanya base URL dan token.
- Token di Android Keystore (EncryptedSharedPreferences). Logout menghapus token.
- Cleartext HTTP hanya untuk `192.168.1.*` lewat `network_security_config.xml`, sisanya ditolak.
- Foto: kamera saja, `WatermarkSpec` dibakar ke bitmap, server membandingkan `createdAtDevice` dengan `server_received_at` dan menandai selisih besar untuk review SPV.
- CORS `api.php`: batasi dari `*` ke origin dashboard yang sah untuk action tulis.
- **Tindak lanjut terpisah (di luar kode app):** kredensial `usr_android`, FTP, RDP ter-commit di [database.js](../../../src/config/database.js) dan [api.php](../../../api.php). Disarankan rotasi dan pindah ke file di luar webroot. Tidak disalin ke app.

## 9. Distribusi dan auto-update (sama seperti MVNative)

Meniru `UpdateManager` / `UpdateViewModel` / `UpdateBanner` di MVNative:

- Server host `stock/updates/version.json` + APK lewat HTTP statis Apache. Tidak ada endpoint PHP baru.
- `version.json`: `versionCode`, `versionName`, `apkFileName`, `notes`, `mandatory`.
- Tiap app dibuka: cek `version.json`, bandingkan `versionCode` dengan `BuildConfig.VERSION_CODE`. Server tidak terjangkau: diam, bukan error.
- Ada update: banner bisa ditutup, tampil 4 detik setelah app terbuka. `mandatory=true`: dialog tak bisa ditutup.
- Unduh via `DownloadManager` ke `getExternalFilesDir/updates`, status gagal dibaca (tidak nyangkut di "Mengunduh"), lalu pasang lewat Package Installer + `FileProvider`. Izin `REQUEST_INSTALL_PACKAGES`.
- **Urutan rilis wajib:** bump versi, build, upload APK, verifikasi `curl -sI` 200, **baru** upload `version.json`.
- Base URL default `http://192.168.1.140/stock/api/`, bisa diubah di pengaturan. Dari LAN kantor jangan pakai IP publik (NAT hairpin timeout, sesuai catatan MEview).
- Signing: MVNative memakai debug keystore hanya karena APK lama sudah beredar. App baru tidak punya beban itu, jadi usul: **keystore rilis khusus**, disimpan di luar git dan dibackup. Hilang keystore berarti semua HP harus install ulang manual. Mohon konfirmasi (bagian 12).

## 10. Penanganan error

- Printer tidak terjangkau: pesan jelas + tombol "Coba lagi" / "Ganti printer", data proposal tetap tersimpan. Cetak ulang tidak membuat proposal baru.
- Sync gagal: `OutboxEntry` tetap `PENDING`, `attempts++`, backoff. Setelah 5 kali gagal berturut-turut jadi `FAILED` dan tampil di layar Status Sync dengan tombol kirim ulang.
- Token kedaluwarsa saat sync: worker berhenti, layar login muncul saat aplikasi dibuka. Data lokal tidak dihapus.
- Kamera ditolak: proposal tidak bisa disimpan, pesan meminta izin.

## 11. Pengujian

- **Unit JVM:** `BarcodeParser` (format `|` dan kasus rusak), `VarianceCalculator`, `MisplacementChecker`, `DuplicateCountPolicy`, byte `EscPosBuilder`, urutan dan idempotensi outbox, `WatermarkSpec`.
- **Instrumented:** Room DAO dan migrasi.
- **Gate verifikasi:** `./gradlew testDebugUnitTest assembleDebug` hijau.
- **Tidak dapat diuji dari lingkungan ini:** printer fisik, DB live 192.168.1.x, DataWedge Zebra asli. Ini akan dinyatakan di laporan akhir, bukan diklaim lulus.
- `api.php`: `php -l` untuk sintaks. Tanpa akses DB, tidak ada tes end-to-end.

## 12. Pertanyaan terbuka

1. ~~Kolom password~~ Terjawab: `user_produksi.userpassword`, `verifyPassword()` pola MEview.
2. Kolom waktu ubah di `item` (menentukan delta sync). Dikerjakan sambil jalan. `MasterSource` mendukung dua strategi. **Belum terverifikasi**: akses baca DB dari sesi ini ditolak, jadi skema harus dicek manual (lihat pesan).
3. **Tidak ada data dummy.** `rack_code` (`RAK-{WCODE}`) dan `shelf_tier` ("Tingkat 2") di `api.php`/`server.js` saat ini karangan dan **dihapus**. App hanya menampilkan field yang punya sumber nyata di DB. Field tanpa sumber tampil "—", tidak diisi tebakan. **Perlu diketahui tabel/kolom mana yang menyimpan rak/bin/tingkat nyata.** Bila memang belum ada di DB, rak/bin dicatat operator saat opname (scan barcode rak) ke tabel `wms_*` dan itulah sumber nyatanya.
4. ~~Hosting APK~~ Terjawab: pola MVNative, `stock/updates/` di server 192.168.1.140 lewat FTP. Sisa: konfirmasi keystore rilis khusus (bagian 9).
5. Data live ada di 192.168.1.140 (menurut kamu), sementara `config.php` MEview dan `api.php` repo ini menunjuk 192.168.1.159. Base URL app memakai 140. Host DB yang dipakai `api.php` di server perlu dikonfirmasi.
