# StockOpnameApi — tahap-1

Service LAN mandiri untuk Android Stock Opname. Tahap ini menyediakan kontrak HTTP,
aturan session/scan idempoten, migration dua tabel, dan fake repository test-only.

## Tidak dilakukan tahap ini

- Tidak terhubung atau menulis ke MySQL produksi.
- Tidak ada allocator serial, print, legacy-label confirm, stock mutation, atau deploy.

Alasannya: schema aktual `wip_handling_unit`, `wip_handling_event`,
`wip_current_stock`, dan allocator serial belum dapat diaudit read-only dari host ini:
akun aplikasi ditolak oleh MySQL pada sumber `192.168.1.108`. Menebak nama/semantik
kolom dapat mengubah stock atau memutus ledger.

## Yang siap

- `SQL/create_stock_opname_schema.sql`: migration eksplisit, idempoten, hanya
  `wip_opname` dan `wip_opname_detail`.
- `POST /api/opname/sessions`
- `GET /api/opname/sessions/:id`
- `GET /api/opname/sessions/:id/summary`
- `POST /api/opname/sessions/:id/scans`
- `POST /api/opname/sessions/:id/close`
- `GET /healthz` tanpa key. Semua route lain wajib `X-API-Key`; perbandingan key
  constant-time dan respons `Cache-Control: no-store`.

`OpnameService` belum di-wire ke service produksi sampai repository MySQL dibuat dari
hasil audit schema. Menjalankan `OPNAME_START_SERVER=1 npm start` sengaja berhenti
sebelum membuka port agar tidak ada service kosong yang disalahgunakan.

## Validasi lokal

```powershell
cd StockOpnameApi
npm ci
npm test
```

## Input audit yang masih wajib

Jalankan di host/akun read-only yang memang diizinkan ke database `produksi`, simpan
hanya struktur kolom/index (jangan dump data/secret):

```sql
SELECT table_name, column_name, column_type, is_nullable, column_key
FROM information_schema.columns
WHERE table_schema = 'produksi'
  AND table_name IN (
    'wip_label', 'wip_label_print_job', 'wip_handling_unit',
    'wip_handling_event', 'wip_current_stock', 'wip_lokasi_m', 'ItemProduksi_m'
  )
ORDER BY table_name, ordinal_position;
```

Lalu implementasi tahap berikutnya dapat memetakan transaction `SELECT ... FOR UPDATE`,
allocator global, print state, event ledger, current stock, dan legacy-label tanpa asumsi.
