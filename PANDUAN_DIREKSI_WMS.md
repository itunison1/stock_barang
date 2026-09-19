# DOKUMEN PANDUAN EKSEKUTIF & ATURAN KERJA SISTEM WMS STOCK OPNAME
## PT Unison Industrial Indonesia — Mode A (Proposal Approval System)

**Ditujukan Kepada:**
- **Bapak Hartarto** (Direksi PT Unison Industrial Indonesia)
- **Bapak Bobby** (Direksi PT Unison Industrial Indonesia)
- **Tim Manajemen & IT PT Unison Industrial Indonesia**

---

### RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)
Aplikasi WMS Stock Opname ini dirancang khusus untuk memecahkan kendala klasik pergudangan manufaktur mur dan baut (fasteners):
1. **Kecepatan di Lorong Rak:** Operator dapat bekerja mandiri tanpa tergantung koneksi internet stabil.
2. **Perlindungan Data Resmi Perusahaan:** Operator **TIDAK BISA** langsung mengubah master stok resmi perusahaan. Semua barang baru/temuan berstatus **`PENDING`** sampai disetujui Direksi/Supervisor.
3. **Efisiensi Kerja (Remote Direct Print):** Operator di tengah lorong rak dapat langsung mencetak dokumen/label ke printer meja kantor direksi/SPV atau meja admin tanpa harus bolak-balik berjalan.
4. **Skalabilitas 11 Gudang:** Memetakan dan melacak persebaran lebih dari **176.673 item mur dan baut** di seluruh fasilitas pergudangan PT Unison.

---

## BAB 1: FILOSOFI & KONSEP "MODE A" (PROPOSAL APPROVAL PATTERN)

```
[OPERATOR DI LORONG RAK]
           │
     Scan Barcode di Rak
           ├─── Barcode Ada di Database? ──► [YA] ──► Input Qty Fisik ──► Simpan ke Data
           │
          [TIDAK] (Barang Temuan Baru / Belum Terdaftar)
           ▼
Form Proposal Cepat (Wajib Foto Fisik Barang)
           │
           ├──► 1. Cetak Label Sticker Thermal [DRAFT PENDING] (Direct TCP:9100)
           │       (Sticker langsung ditempel di peti/karung agar tidak tertukar)
           │
           └──► 2. Simpan Status = PENDING di Antrian HP (Room DB Offline-Ready)
                       │
                       ▼ (WorkManager Auto-Sync saat Terhubung WiFi)
           [SUPERVISOR & DIREKSI APPROVAL GATE]
                       │
             Review Foto, Lokasi Rak & Qty
           ┌───────────┴───────────┐
           ▼                       ▼
      [APPROVE]                [REJECT]
   Status jadi ACTIVE       Status REJECTED
  Masuk Stok Resmi         Beri Alasan Penolakan
  Audit Log Tercatat       Feedback ke Operator
```

> **Prinsip Utama:** HP Operator berfungsi sebagai **alat pengumpul data (collector) & remote printer**, **BUKAN** penentu data resmi. Sumber kebenaran tunggal (*Single Source of Truth*) tetap berada di Database Pusat PT Unison Industrial Indonesia.

---

## BAB 2: ATURAN DETAIL OPERATOR DI LORONG RAK (RULE 1)

1. **Penguncian Sesi Gudang:**
   - Operator memilih/men-scan kode gudang tempat ia bekerja (dari 11 gudang: `U2 GUDANG1` s/d `U1`).
2. **Scan Barcode Tertempel:**
   - Operator men-scan barcode yang sudah tertempel pada kemasan kardus, peti, karung, atau ambalan rak.
3. **Informasi yang Ditampilkan Otomatis di Layar HP:**
   - **Nama & Spesifikasi Barang:** Contoh: `BAUT 3/8 x 50 CEMET` (Kode: `AB6C50`).
   - **Letak Gudang Terdaftar:** Sistem langsung menampilkan lokasi resmi barang (misal: `U2 GUDANG3`).
   - **Nomor Rak & Baris Tingkat:** Contoh: `Rak RAK-B-03`, `Tingkat 2 (Baris B)`, `Bin: BIN-3B`.
   - **Jenis Kemasan & Satuan:** Menampilkan kemasan standar pabrik (**KARUNG**, **PETI**, **CARTON**, **DOS**) beserta isi satuan (*PCS* / *SET*).
   - **Stok Sistem vs Input Fisik:** Operator memasukkan jumlah fisik yang dihitung di tempat. Sistem otomatis menghitung selisih/variance:
     $$\text{Selisih (Variance)} = \text{Qty Fisik} - \text{Qty Sistem}$$
4. **Peringatan Relokasi Cerdas (Smart Misplacement Alert):**
   - Jika operator sedang opname di `U2 GUDANG1`, namun men-scan baut yang tercatat di `U2 GUDANG3`, aplikasi langsung memberikan peringatan: *"Barang terdaftar di U2 GUDANG3, tetapi di-scan di U2 GUDANG1. Rekam pemindahan lokasi?"*.

---

## BAB 3: ATURAN REMOTE DIRECT PRINT KE KANTOR (RULE 2)

Operator yang berada jauh di tengah-tengah lorong rak gudang tidak perlu berjalan kaki ke kantor hanya untuk mencetak label. Dari HP genggamnya:
1. Operator memilih target printer pada menu **Target Print Selector**:
   - 🏢 **Printer Meja Kantor Direksi & SPV (IP 192.168.1.140:9100)**: Dokumen/label langsung keluar di meja kantor.
   - 🖥️ **Printer Meja Operator Depan Lorong (IP 192.168.1.50:9100)**: Label keluar di pos kerja depan lorong.
   - 🖨️ **Printer Meja Admin Gudang Jaya (IP 192.168.1.51:9100)**.
   - 📱 **Printer Mobile Bluetooth Pinggang (IP 192.168.1.52:9100)**.
2. Pengiriman menggunakan **Raw TCP Socket Port 9100** berstandar ESC/POS langsung dari IP HP ke IP printer tanpa harus membebani server web atau menunggu antrian cloud.
3. Pada label barang proposal tertera watermark tegas: **`⚠️ DRAFT - PENDING APPROVAL`**.

---

## BAB 4: PERLINDUNGAN OFFLINE-FIRST (BLIND SPOT PROTECTION)

Gudang manufaktur mur dan baut berdinding baja dan tumpukan peti tebal seringkali mengalami *blank spot* sinyal WiFi.
1. Saat jaringan mati (**OFFLINE / BLIND SPOT**):
   - HP Operator **TIDAK AKAN CRASH ATAU BERHENTI BEKERJA**.
   - Semua scan, hitung fisik, dan proposal baru disimpan ke database lokal HP (Room DB).
   - Label thermal tetap bisa dicetak langsung jika printer berada di jaringan lokal yang sama.
2. Saat jaringan menyala kembali (**ONLINE**):
   - Komponen Android **WorkManager** otomatis mengeksekusi *background sync*.
   - Data dikirim ke server backend `192.168.1.140` secara transaksional tanpa memerlukan tindakan manual dari operator.

---

## BAB 5: HAK OTORITAS DIREKSI & SUPERVISOR (APPROVAL GATE)

Untuk mencegah masuknya data fiktif atau kesalahan identifikasi ulir:
1. **Hak Akses Tingkat Direksi (Pak Hartarto & Pak Bobby) & Supervisor:**
   - Melihat antrian seluruh barang berstatus `PENDING` lengkap dengan **foto fisik asli** yang diambil operator di lapangan.
   - Memeriksa kebenaran spesifikasi ulir, diameter, panjang, dan jenis kemasan (Peti/Karung).
   - **Aksi Setujui (Approve):** Merubah status barang menjadi `ACTIVE`, mencatat stempel `approved_by` dan `approved_at`, serta menambahkan jumlah stok ke master resmi perusahaan.
   - **Aksi Tolak (Reject):** Memasukkan alasan penolakan (misal: *"Foto blur"*, *"Salah jenis ulir"*, *"Bukan stok PT Unison"*). Status berubah menjadi `REJECTED` dan operator menerima catatan evaluasi.
2. **Pencatatan Audit Trail Permanen:**
   - Setiap aksi (siapa yang scan, siapa yang mencetak, siapa yang approve, jam berapa, dan IP address-nya) tercatat permanen di tabel `audit_logs`.

---

## BAB 6: STRUKTUR 11 GUDANG PT UNISON INDUSTRIAL INDONESIA

Aplikasi telah memetakan 11 gudang operasional:
| No | Kode Gudang | Fungsi & Zona Kerja | Jumlah Rak | Default Printer |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `U2 GUDANG1` | Fastener Finishing & Packing | 24 Rak | Meja Operator U2 (1.50) |
| 2 | `U2 GUDANG2` | Penyimpanan Mur & Hex Nut Storage | 36 Rak | Meja Operator U2 (1.50) |
| 3 | `U2 GUDANG3` | Baut Hexagon & Socket Cap L | 40 Rak | Kantor Direksi (1.140) |
| 4 | `U2 GUDANG4` | Stainless Steel (SS304 / SS316) | 28 Rak | Kantor Direksi (1.140) |
| 5 | `U2 GUDANG5` | Plating & Galvanizing Stock | 30 Rak | Kantor Direksi (1.140) |
| 6 | `U2 GUDANG6` | Heavy Stock & Bulk Peti Kayu | 48 Rak | Gudang Jaya (1.51) |
| 7 | `U2 F29` | Machining & Special Tapping | 16 Rak | Gudang Jaya (1.51) |
| 8 | `U2 UCP` | Central Staging & Quality Control | 20 Rak | Meja Operator U2 (1.50) |
| 9 | `GUDANG JAYA` | Logistik & Distribusi Pengiriman | 50 Rak | Gudang Jaya (1.51) |
| 10 | `D30` | Raw Materials & Wire Rod Coils | 12 Rak | Gudang Jaya (1.51) |
| 11 | `U1` | Distribution & Finished Goods | 32 Rak | Gudang Jaya (1.51) |

---

## BAB 7: KONEKTIVITAS DATABASE LIVE `produksi` (176.673 ITEM)

* **Server Database:** `192.168.1.159:3306` & `192.168.1.140:3306`
* **Nama Database:** `produksi`
* **User / Password:** `usr_android` / `zUNSprod`
* **Tabel Master:**
  - `item`: Berisi **176.673 record** fastener (Kode item, Nama spesifikasi, Kemasan Karung/Peti, Stok sistem).
  - `user_produksi`: Berisi data otentikasi pengguna (`hartarto`, `bobby`, `cseon`, `kirana`, `rangga`, dll).
* **Bridge API Backend:** Berjalan di port `3001` menghubungkan web frontend ke MySQL secara instan dan aman.

---

*Dokumen ini disusun untuk PT Unison Industrial Indonesia — Sistem Manajemen Pergudangan & Stock Opname Cerdas.*
