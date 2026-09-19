import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { UnisonLogo } from './UnisonLogo';
import { UNISON_DB_CONFIG } from '../../config/database';

export const ExecutivePresentationModal = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Keyboard navigation (Arrow keys)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const slides = [
    {
      title: 'Ringkasan Eksekutif & Mengapa Menggunakan "Mode A"',
      subtitle: 'Konsep Dasar: Proposal Approval System untuk Melindungi Integritas Stok Resmi',
      badge: 'BAB 1 • EXECUTIVE SUMMARY',
      content: (
        <div className="space-y-4 text-slate-200 text-xs leading-relaxed font-sans">
          <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-900/50">
            <h4 className="text-sm font-bold text-blue-300 mb-1.5">Latar Belakang & Masalah Lapangan</h4>
            <p>
              Pada gudang manufaktur mur dan baut, operator sering menemukan barang di rak yang belum ada kode barcode-nya atau belum terdaftar di sistem. Jika operator diblokir tidak bisa kerja, proses opname macet. Sebaliknya, jika operator bebas menambahkan barang langsung ke stok resmi, data perusahaan rentan salah atau tidak akurat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Icon name="alertTriangle" size={14} /> Solusi Mode A (Proposal Pattern)
              </div>
              <p className="text-[11px] text-slate-300">
                Operator lapangan <b>TIDAK DIBLOKIR</b>. Barang temuan baru dibuatkan proposal cepat berstatus <b>PENDING</b>, label sticker draft langsung dicetak di tempat dan ditempel pada kemasan peti/karung agar fisik barang teridentifikasi.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Icon name="shield" size={14} /> Hak Otoritas Approval & Validasi
              </div>
              <p className="text-[11px] text-slate-300">
                Barang baru <b>TIDAK AKAN MASUK</b> ke stok resmi perusahaan sebelum <b>Supervisor / Otorisasi Manajemen</b> memeriksa foto fisik dan menekan tombol <b>Approve</b>.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Alur Operator di Lorong Rak (Rule 1)',
      subtitle: 'Scan Barcode Tertempel & Muncul Letak Gudang Serta Nomor Rak Otomatis',
      badge: 'BAB 2 • ATURAN OPERATOR',
      content: (
        <div className="space-y-3 text-slate-200 text-xs leading-relaxed font-sans">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
              <Icon name="scan" size={14} /> Bagaimana Operator Bekerja di Lorong:
            </div>
            <ol className="list-decimal pl-5 space-y-1.5 text-[11px] text-slate-300">
              <li>Operator berjalan menyusuri lorong rak dengan membawa HP genggam (Handheld PDA).</li>
              <li>Operator men-scan barcode yang sudah tertempel pada kemasan kardus, karung, atau peti kayu.</li>
              <li>
                <b>Informasi Otomatis Muncul di Layar HP:</b>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-400 font-mono text-[10px]">
                  <li>Nama Barang: <b>BAUT 3/8 x 50 CEMET</b> (Kode: AB6C50)</li>
                  <li>Letak Gudang: <span className="text-amber-400 font-bold">U2 GUDANG3</span></li>
                  <li>Nomor Rak: <span className="text-emerald-400 font-bold">RAK-B-03 • Tingkat 2 (Baris B)</span></li>
                  <li>Kemasan Resmi: <b>KARUNG (1.000 PCS / Karung)</b></li>
                  <li>Stok Terdata di Sistem vs Qty Fisik yang Baru Dihitung</li>
                </ul>
              </li>
              <li>
                <b>Peringatan Relokasi:</b> Jika operator sedang di U2 GUDANG1 tapi barang tercatat di U2 GUDANG3, muncul peringatan potensi salah taruh (*misplacement*).
              </li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      title: 'Remote Direct Print ke Meja Kantor / Operator (Rule 2)',
      subtitle: 'Cetak Dokumen & Label Langsung dari Tengah Rak Melalui Socket TCP:9100',
      badge: 'BAB 3 • REMOTE PRINTING',
      content: (
        <div className="space-y-3 text-slate-200 text-xs leading-relaxed font-sans">
          <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-900/50 space-y-2">
            <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Icon name="printer" size={15} /> Efisiensi Tanpa Bolak-Balik ke Ruang Kantor
            </h4>
            <p className="text-[11px] text-slate-300">
              Operator yang posisinya berada jauh di tengah-tengah lorong rak dapat langsung mengirim instruksi cetak ke printer meja kantor direksi atau meja admin depan lorong tanpa harus meninggalkan posisinya.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-[11px]">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-400 font-bold text-[10px]">PILIHAN 1: PRINTER MEJA KANTOR</div>
              <div className="text-purple-300 font-bold mt-0.5">IP 192.168.1.140:9100</div>
              <div className="text-slate-500 text-[10px] mt-1">Struk/label keluar langsung di meja kantor Direksi/SPV untuk arsip atau pengecekan.</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-400 font-bold text-[10px]">PILIHAN 2: PRINTER MEJA OPERATOR</div>
              <div className="text-purple-300 font-bold mt-0.5">IP 192.168.1.50:9100</div>
              <div className="text-slate-500 text-[10px] mt-1">Label keluar di meja kerja depan lorong, siap diambil setelah selesai satu blok rak.</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Perlindungan Offline-First (Blind Spot Area)',
      subtitle: 'Gudang Baja Sering Blank Spot WiFi: Aplikasi Tetap Lancar Tanpa Internet',
      badge: 'BAB 4 • OFFLINE ARCHITECTURE',
      content: (
        <div className="space-y-3 text-slate-200 text-xs leading-relaxed font-sans">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Icon name="wifiOff" size={15} /> Mekanisme Kerja Saat Sinyal Putus
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc pl-5">
              <li>
                <b>Database Lokal di HP (Room DB):</b> Master barang sudah di-cache di memori internal HP saat operator login di awal shift.
              </li>
              <li>
                <b>Scan & Hitung Tidak Pernah Macet:</b> Saat operator masuk ke area blind spot (tumpukan peti baja tebal), proses scan barcode dan input fisik tetap berjalan lancar 100%.
              </li>
              <li>
                <b>WorkManager Background Sync:</b> Begitu operator keluar lorong dan HP kembali menangkap sinyal WiFi, sistem Android secara otomatis mengeksekusi sinkronisasi data ke server database pusat tanpa perlu menekan tombol apa pun.
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'Hak Approval Gate & Otorisasi Sistem (Mode A)',
      subtitle: 'Kewenangan Verifikasi Lapangan dalam Menjaga Integritas Stok Resmi',
      badge: 'BAB 5 • APPROVAL GATE',
      content: (
        <div className="space-y-3 text-slate-200 text-xs leading-relaxed font-sans">
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-900/50 space-y-1.5">
            <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Icon name="shield" size={15} /> Mengapa Keputusan Ada di Tangan Supervisor / Manajemen?
            </h4>
            <p className="text-[11px] text-slate-300">
              Dalam industri mur dan baut, beda diameter ulir 1 milimeter (misal M8 vs M10) atau beda material (Baja 8.8 vs Stainless SS304) sangat fatal jika salah catat. Oleh karena itu, operator diwajibkan menyertakan <b>FOTO FISIK ASLI</b>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-900 border border-emerald-900/60 text-slate-300">
              <div className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <Icon name="checkCircle" size={13} /> SETUJUI (APPROVE)
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Status barang berubah menjadi <b>ACTIVE</b>, qty fisik resmi masuk ke pembukuan stok perusahaan, dan tercatat di Audit Log dengan nama otoritas yang menyetujui.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-red-900/60 text-slate-300">
              <div className="text-red-400 font-bold text-xs flex items-center gap-1">
                <Icon name="xCircle" size={13} /> TOLAK (REJECT)
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Supervisor memasukkan alasan penolakan (misal: "Ulir salah", "Bukan barang standar Unison"). Status berubah jadi <b>REJECTED</b> dan operator menerima catatan evaluasi.
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Struktur 11 Gudang PT Unison Industrial Indonesia',
      subtitle: 'Pemetaan Seluruh Fasilitas Pergudangan & Produksi',
      badge: 'BAB 6 • STRUKTUR 11 GUDANG',
      content: (
        <div className="space-y-3 text-xs font-mono">
          <p className="text-slate-300 font-sans text-xs">
            Sistem WMS memetakan 11 gudang resmi PT Unison untuk pelacakan pergerakan dan posisi barang:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {UNISON_DB_CONFIG.warehouses.map((wh) => (
              <div key={wh.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-amber-400 font-bold text-xs">{wh.code}</div>
                <div className="text-slate-300 text-[10px]">{wh.name}</div>
                <div className="text-slate-500 text-[9px] mt-0.5 truncate">{wh.zone}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Integrasi Nyata Database `produksi` (176.673 Barang)',
      subtitle: 'Aplikasi Terhubung Langsung ke Server MySQL Perusahaan Melalui Kredensial Resmi',
      badge: 'BAB 7 • LIVE DATABASE',
      content: (
        <div className="space-y-3 text-slate-200 text-xs leading-relaxed font-mono">
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/50 space-y-2">
            <div className="flex items-center justify-between text-emerald-400 font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <Icon name="database" size={15} /> STATUS KONEKSI DATABASE PRODUKSI
              </span>
              <span className="bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 text-[10px]">
                ● AKTIF / TERHUBUNG
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px] pt-1">
              <div>Server IP: <b className="text-slate-100">192.168.1.159:3306</b></div>
              <div>Database: <b className="text-emerald-300">produksi</b></div>
              <div>User: <b className="text-slate-100">usr_android</b></div>
              <div>Total Data: <b className="text-amber-400 font-bold">176.673 Item Fasteners</b></div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-sans">
            Aplikasi web ini bukan sekadar simulasi mockup statis, melainkan sudah dilengkapi <b>Backend API Bridge nyata</b> yang mampu membaca dan menyajikan data dari tabel <code>item</code> dan <code>user_produksi</code> secara instan.
          </div>
        </div>
      ),
    },
  ];

  const slide = slides[currentSlide];

  const handleCopyLink = () => {
    const directUrl = `${window.location.origin}${window.location.pathname}#alur-kerja`;
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'} animate-fade-in`}>
      <div className={`relative w-full bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
        isFullscreen ? 'h-screen w-screen max-w-none max-h-none rounded-none' : 'max-w-4xl rounded-3xl max-h-[92vh]'
      }`}>
        {/* Presentation Header */}
        <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UnisonLogo size="sm" showText={false} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                  ATURAN & ALUR KERJA SISTEM WMS
                </h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                  PT UNISON
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dokumentasi Konsep, Standar Operasional & Alur Kerja Mode A
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 transition-colors"
              title={isFullscreen ? 'Keluar mode layar penuh (Normal)' : 'Mode Layar Penuh'}
            >
              <span>{isFullscreen ? '❐ Normal' : '⛶ Layar Penuh'}</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-blue-300 text-[10px] font-mono flex items-center gap-1 transition-colors"
              title="Salin tautan langsung ke halaman Alur Kerja ini"
            >
              <Icon name="link" size={12} />
              <span>{copiedLink ? '✓ Tersalin!' : 'Salin Link'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>

        {/* Slide Tracker Pills */}
        <div className="bg-slate-950 px-6 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono overflow-x-auto gap-2">
          <div className="flex gap-1.5">
            {slides.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  currentSlide === idx
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                Bab {idx + 1}
              </button>
            ))}
          </div>
          <span className="text-slate-500 text-[10px] whitespace-nowrap">
            {currentSlide + 1} dari {slides.length} Bab
          </span>
        </div>

        {/* Slide Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950 space-y-4">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-900">
              {slide.badge}
            </span>
            <h2 className="text-base font-bold text-white mt-2 tracking-tight">
              {slide.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {slide.subtitle}
            </p>
          </div>

          <div className="pt-2">{slide.content}</div>
        </div>

        {/* Presentation Footer with Next/Prev Controls */}
        <div className="px-6 py-3.5 bg-slate-850 border-t border-slate-700 flex items-center justify-between text-xs font-mono">
          <button
            onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            ← Bab Sebelumnya
          </button>

          <div className="text-slate-400 text-[11px]">
            PT Unison Industrial Indonesia • Mode A
          </div>

          {currentSlide < slides.length - 1 ? (
            <button
              onClick={() => setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors flex items-center gap-1.5 shadow"
            >
              Bab Berikutnya →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow"
            >
              Selesai Presentasi ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
