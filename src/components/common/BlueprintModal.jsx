import React from 'react';
import { Icon } from './Icons';

export const BlueprintModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      step: 1,
      title: 'Login & Download Master Active',
      actor: 'OPERATOR',
      color: 'blue',
      desc: 'Operator login via HP Android. Aplikasi otomatis mengunduh produk WHERE status=active, locations, dan printers ke Room DB lokal.',
    },
    {
      step: 2,
      title: 'Scan Lokasi Rak (QR / Barcode)',
      actor: 'OPERATOR',
      color: 'slate',
      desc: 'Scan barcode rak (misal: RAK-A-01). Sesi terkunci untuk lokasi tersebut dan printer thermal LAN terdekat langsung terhubung.',
    },
    {
      step: 3,
      title: 'Scan Barcode Barang Fisik',
      actor: 'OPERATOR',
      color: 'slate',
      desc: 'Scan barcode barang di rak. Aplikasi mengecek ke Room DB lokal terlebih dahulu (offline-ready).',
    },
    {
      step: 4,
      title: 'IF Ditemukan: Input Qty Fisik',
      actor: 'OPERATOR',
      color: 'emerald',
      desc: 'Form input jumlah fisik. Aplikasi otomatis menghitung selisih (variance = fisik - sistem) dan mencatat ke sesi opname.',
    },
    {
      step: 5,
      title: 'IF Tidak Ditemukan: Form Proposal (PENDING) + Direct Print',
      actor: 'OPERATOR',
      color: 'amber',
      highlight: true,
      desc: 'Kunci Mode A: Operator tidak diblokir! Mengisi nama, barcode, foto wajib, dan qty fisik. Label sticker [DRAFT PENDING] langsung tercetak via TCP:9100 tanpa hop server. Disimpan status=pending di Room DB.',
    },
    {
      step: 6,
      title: 'Sync ke Server (WorkManager Background)',
      actor: 'OPERATOR / WORKMANAGER',
      color: 'blue',
      desc: 'Jika ada blank spot WiFi, antrian tetap aman di Room DB. Begitu WiFi aktif, WorkManager otomatis mengunggah sesi opname dan proposal ke server.',
    },
    {
      step: 7,
      title: 'Dashboard Web: Supervisor Review Foto & Data',
      actor: 'SUPERVISOR GATE',
      color: 'amber',
      highlight: true,
      desc: 'Supervisor membuka Web Dashboard tab "Approval Queue". Memeriksa foto fisik, barcode, rak, dan operator pengaju. Menentukan Approve atau Reject (dengan alasan).',
    },
    {
      step: 8,
      title: 'Jika Approve: Status ACTIVE, Masuk Stok Resmi',
      actor: 'SISTEM RESMI',
      color: 'emerald',
      desc: 'Saat disetujui: status produk berubah menjadi ACTIVE, qty fisik masuk ke stok sistem resmi perusahaan, dan tercatat di Audit Log. Semua HP operator menerima update pada sync berikutnya.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Icon name="layers" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">BLUEPRINT ALUR KERJA — MODE A</h3>
              <p className="text-xs text-slate-400">Proposal Approval System • 8 Langkah End-to-End</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Steps List */}
        <div className="p-6 overflow-y-auto space-y-3 bg-slate-950">
          {steps.map((s) => (
            <div
              key={s.step}
              className={`p-3.5 rounded-2xl border flex gap-3.5 items-start ${
                s.highlight
                  ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div
                className={`h-8 w-8 rounded-xl shrink-0 flex items-center justify-center font-mono font-bold text-xs ${
                  s.color === 'blue'
                    ? 'bg-blue-600 text-white'
                    : s.color === 'amber'
                    ? 'bg-amber-600 text-white'
                    : s.color === 'emerald'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {s.step}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-100">{s.title}</h4>
                  <span
                    className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                      s.color === 'amber'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : s.color === 'emerald'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-blue-950 text-blue-300 border border-blue-800'
                    }`}
                  >
                    {s.actor}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-850 border-t border-slate-700 flex justify-between items-center text-xs font-mono text-slate-400">
          <span>Prinsip: HP = Collector & Direct Printer • DB Perusahaan = Source of Truth</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
