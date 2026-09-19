import React, { useState } from 'react';
import { Icon } from '../common/Icons';
import { useWms } from '../../services/store';

const SAMPLE_PHOTOS = [
  { label: 'Baut Hexagon SS304', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80' },
  { label: 'Mur Hex Nut M10', url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=400&q=80' },
  { label: 'Baut L Socket Cap', url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400&q=80' },
  { label: 'Flange Nut Kuning', url: 'https://images.unsplash.com/photo-1618090584176-7132b9911657?w=400&q=80' },
  { label: 'Ring Plat Washer', url: 'https://images.unsplash.com/photo-1589792905706-7b4bf37d2fbf?w=400&q=80' },
];

export const ProposalModal = ({ barcode, onClose, onSuccess }) => {
  const { currentRack, createProposal, isOnline } = useWms();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Baut Hexagon');
  const [proposedQty, setProposedQty] = useState('500');
  const [photoUrl, setPhotoUrl] = useState(SAMPLE_PHOTOS[0].url);
  const [notes, setNotes] = useState('Stok mur/baut baru ditemukan di rak saat opname.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoMode, setPhotoMode] = useState('presets'); // 'presets' | 'upload'

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nama spesifikasi mur/baut wajib diisi!');
      return;
    }
    if (!photoUrl) {
      alert('Mode A mewajibkan foto fisik mur/baut untuk bukti review supervisor!');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newProposal = createProposal({
        barcode,
        name,
        category,
        photoUrl,
        proposedQty,
        notes,
        locationCode: currentRack?.code || 'U2 GUDANG1',
      });
      setIsSubmitting(false);
      onSuccess(newProposal);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Banner Alert Mode A */}
        <div className="bg-gradient-to-r from-amber-600/30 to-amber-950/40 border-b border-amber-500/30 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Icon name="alertTriangle" size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-200 tracking-wide">
                MODE A — BARANG TIDAK TERDAFTAR
              </div>
              <div className="text-[10px] text-amber-300/80 font-mono">
                PT Unison Industrial Indonesia • Direct Thermal Print • Menunggu Approval SPV
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Barcode & Location Fixed Tags */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Barcode Terdeteksi</div>
              <div className="text-xs font-mono font-bold text-amber-400 mt-0.5 break-all">{barcode}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Gudang / Lokasi Terkunci</div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {currentRack?.code || 'U2 GUDANG1'}
              </div>
            </div>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Spesifikasi Mur / Baut <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Baut Hexagon M12 x 40 mm Grade 8.8"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Category & Physical Qty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">Kategori Fastener</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="Baut Hexagon">Baut Hexagon</option>
                <option value="Mur / Hex Nut">Mur / Hex Nut</option>
                <option value="Baut Socket Cap">Baut Socket Cap (L)</option>
                <option value="Flange & Lock Nut">Flange & Lock Nut</option>
                <option value="Ring Plat & Washer">Ring Plat & Washer</option>
                <option value="Sekrup & Tapping">Sekrup & Tapping</option>
                <option value="Anchor & Dynabolt">Anchor & Dynabolt</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Qty Fisik Ditemukan (pcs) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={proposedQty}
                onChange={(e) => setProposedQty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Photo Section (Mandatory in Mode A) */}
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Icon name="camera" size={14} className="text-amber-400" />
                Foto Fisik Barang <span className="text-red-400 font-mono text-[10px]">(WAJIB MODE A)</span>
              </label>
              <div className="flex gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPhotoMode('presets')}
                  className={`px-2 py-0.5 rounded ${photoMode === 'presets' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                >
                  Preset Fasteners
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoMode('upload')}
                  className={`px-2 py-0.5 rounded ${photoMode === 'upload' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                >
                  Kamera / Upload
                </button>
              </div>
            </div>

            {/* Photo Preview */}
            <div className="flex gap-3 items-center">
              <div className="w-24 h-24 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden shrink-0 relative">
                {photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600">
                    <Icon name="camera" size={24} />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[8px] font-mono text-center py-0.5 text-slate-300">
                  QC BUKTI
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {photoMode === 'presets' ? (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-400">Pilih sampel produk fastener:</div>
                    <div className="flex flex-wrap gap-1">
                      {SAMPLE_PHOTOS.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setPhotoUrl(item.url)}
                          className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                            photoUrl === item.url
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      Ambil foto produk mur/baut via kamera atau unggah:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:bg-amber-600 file:text-white hover:file:bg-amber-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1">Catatan Lokasi Rak & Kondisi</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Ditemukan di palet samping lorong 3"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Offline Notice */}
          {!isOnline && (
            <div className="rounded-lg bg-amber-950/40 border border-amber-800/60 p-2.5 flex items-center gap-2 text-[11px] text-amber-300">
              <Icon name="wifiOff" size={14} className="shrink-0" />
              <span>
                Perangkat sedang <b>OFFLINE</b>. Proposal akan disimpan di Room DB lokal dan otomatis disinkronkan saat WiFi kembali menyala.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950 transition-all disabled:opacity-50"
            >
              <Icon name="printer" size={16} />
              {isSubmitting ? 'Memproses...' : 'Cetak Label & Ajukan Proposal (PENDING)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
